import { Injectable, computed, signal } from '@angular/core';
import { isSameDay, minutesOfDay, startOfDay } from './doctor.dates';
import {
  MOCK_APPOINTMENTS,
  MOCK_DOCTOR_PROFILE,
  MOCK_PATIENTS,
  MOCK_SCHEDULE,
  SIGNED_IN_DOCTOR_ID,
} from './doctor.mock-data';
import type {
  Appointment,
  AppointmentStatus,
  DoctorProfile,
  Patient,
  PatientSummary,
  ProfileDraft,
  ScheduleDay,
} from './doctor.models';

/** A status that ends an appointment's life, so it can no longer be acted on. */
const CLOSED_STATUSES: readonly AppointmentStatus[] = ['completed', 'cancelled', 'no-show'];

/** Statuses that mean the patient is expected to turn up. */
const LIVE_STATUSES: readonly AppointmentStatus[] = ['booked', 'confirmed'];

const byStart = (a: Appointment, b: Appointment): number => a.startsAt.localeCompare(b.startsAt);

/**
 * In-memory stand-in for the Doctor API.
 *
 * Every screen in the Doctor area reads from here, so the whole area can be
 * exercised end to end without a backend. Replacing this with a service that
 * talks to the API is the only change the screens should ever need.
 *
 * Two rules are enforced here rather than in the pages, because they are about
 * who may see what rather than how it looks:
 * - an appointment is only returned if it belongs to the signed-in doctor;
 * - a patient is only returned if they have at least one appointment with them.
 *
 * The pages can therefore never widen access by accident, and a real service
 * gets the same rule from the API instead of from a filter in a template.
 */
@Injectable()
export class DoctorSession {
  private readonly appointmentState = signal<Appointment[]>([...MOCK_APPOINTMENTS]);
  private readonly patientState = signal<Patient[]>([...MOCK_PATIENTS]);
  private readonly scheduleState = signal<ScheduleDay[]>(MOCK_SCHEDULE.map((day) => ({ ...day })));
  private readonly profileState = signal<DoctorProfile>({ ...MOCK_DOCTOR_PROFILE });

  /**
   * The area's single clock.
   *
   * A signal rather than `new Date()` inside the computeds: a `computed` that
   * read the wall clock would be correct only for the first read and cached
   * forever after, so an app left open across midnight would keep showing
   * yesterday. Exposed so tests can pin it, and so a future real service can
   * replace it with the response's timestamp.
   */
  readonly now = signal(new Date());

  readonly doctorId = SIGNED_IN_DOCTOR_ID;

  readonly profile = computed(() => this.profileState());

  /** The signed-in doctor's appointments, soonest first. */
  readonly appointments = computed(() =>
    this.appointmentState()
      .filter((appointment) => appointment.doctorId === this.doctorId)
      .sort(byStart),
  );

  /** Today's list, cancelled appointments dropped so the day reads as a plan. */
  readonly todaysAppointments = computed(() => {
    const now = this.now();
    return this.appointments().filter(
      (appointment) =>
        isSameDay(new Date(appointment.startsAt), now) &&
        !CLOSED_STATUSES.includes(appointment.status),
    );
  });

  /** The next appointment still to happen, or `null` when the list is clear. */
  readonly nextAppointment = computed(() => {
    const now = this.now().getTime();
    return (
      this.appointments().find(
        (appointment) =>
          LIVE_STATUSES.includes(appointment.status) &&
          new Date(appointment.startsAt).getTime() >= now,
      ) ?? null
    );
  });

  /** Booked but not yet confirmed — the queue that needs a decision. */
  readonly awaitingConfirmation = computed(() =>
    this.appointments().filter((appointment) => appointment.status === 'booked'),
  );

  /** Consultations that happened in the seven days up to `now`. */
  readonly completedThisWeek = computed(() => {
    const since = startOfDay(this.now()).getTime() - 6 * 24 * 60 * 60 * 1000;
    return this.appointments().filter(
      (appointment) =>
        appointment.status === 'completed' && new Date(appointment.startsAt).getTime() >= since,
    );
  });

  /**
   * Patients this doctor has seen or is due to see.
   *
   * Derived from the appointments rather than read from `patientState`
   * directly, which is what keeps an unrelated patient out of the list.
   */
  readonly patients = computed<PatientSummary[]>(() => {
    const mine = this.appointments();
    const now = this.now().getTime();

    return this.patientState()
      .map((patient): PatientSummary | null => {
        const history = mine
          .filter((appointment) => appointment.patientId === patient.id)
          .sort(byStart);
        if (!history.length) return null;

        const past = history.filter(
          (appointment) => new Date(appointment.startsAt).getTime() < now,
        );
        const future = history.filter(
          (appointment) =>
            new Date(appointment.startsAt).getTime() >= now &&
            !CLOSED_STATUSES.includes(appointment.status),
        );

        return {
          patient,
          lastVisit: past.length ? past[past.length - 1] : null,
          nextVisit: future.length ? future[0] : null,
          visitCount: history.filter(
            (appointment) => appointment.status === 'completed' || appointment.status === 'no-show',
          ).length,
        };
      })
      .filter((summary): summary is PatientSummary => summary !== null);
  });

  readonly schedule = computed(() =>
    [...this.scheduleState()].sort((a, b) => a.dayOfWeek - b.dayOfWeek),
  );

  /** Minutes the doctor publishes per week, for the schedule summary. */
  readonly weeklyMinutes = computed(() =>
    this.scheduleState().reduce((total, day) => {
      if (!day.enabled) return total;
      const start = minutesOfDay(day.startTime);
      const end = minutesOfDay(day.endTime);
      if (start === null || end === null || end <= start) return total;
      return total + (end - start);
    }, 0),
  );

  /** Patient lookup that tolerates a bad route param instead of throwing. */
  patientById(id: string): Patient | null {
    return this.patientState().find((patient) => patient.id === id) ?? null;
  }

  /**
   * A patient, but only once this doctor has a relationship with them.
   *
   * The list pages derive from appointments, so they cannot leak. A details page
   * addressed by `/doctor/patients/:id` could: the id is a URL, and a URL can
   * be typed. Resolving through the same relationship check means the boundary
   * lives in one place, and an id the doctor has no business seeing resolves to
   * the same "not found" as a nonsense one.
   */
  patientForDoctor(id: string): Patient | null {
    if (!id) return null;
    const known = this.appointments().some((appointment) => appointment.patientId === id);
    return known ? this.patientById(id) : null;
  }

  /** A patient's appointments with this doctor, soonest first. */
  appointmentsForPatient(patientId: string): Appointment[] {
    return this.appointments().filter((appointment) => appointment.patientId === patientId);
  }

  /** Name for a table cell, so a missing patient never renders as `undefined`. */
  patientName(patientId: string): string {
    return this.patientById(patientId)?.name ?? 'Unknown patient';
  }

  /**
   * Moves an appointment to a new status.
   *
   * Ignores an unknown id, another doctor's appointment, and a status the
   * appointment already holds — so a double click cannot append a duplicate
   * row, and a caller cannot reach across the scoping rule by guessing an id.
   * Returns whether anything changed, which is what the caller uses to decide
   * to show a confirmation.
   */
  setAppointmentStatus(id: string, status: AppointmentStatus): boolean {
    const current = this.appointmentState().find(
      (appointment) => appointment.id === id && appointment.doctorId === this.doctorId,
    );
    if (!current || current.status === status) return false;
    this.appointmentState.update((appointments) =>
      appointments.map((appointment) =>
        appointment.id === id ? { ...appointment, status } : appointment,
      ),
    );
    return true;
  }

  /** Replaces the published availability with a saved week. */
  saveSchedule(days: readonly ScheduleDay[]): void {
    this.scheduleState.set(days.map((day) => ({ ...day })));
  }

  /** Applies the fields the Profile page is allowed to change. */
  updateProfile(draft: ProfileDraft): void {
    this.profileState.update((profile) => ({ ...profile, ...draft }));
  }
}
