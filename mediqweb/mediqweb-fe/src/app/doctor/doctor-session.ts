import { Injectable, computed, signal, inject } from '@angular/core';
import type { AccountStatus } from '../shared/domain/account-status';
import { HttpPatientGateway } from '../core/api/http-patient-gateway';
import type { UserProfile } from '../core/api/models';
import {
  blockMinutes,
  dayKey,
  isSameDay,
  minutesOfDay,
  parseDayKey,
  startOfDay,
  usableBlocks,
} from './doctor.dates';
import { switchMap, map } from 'rxjs';
import type {
  Appointment,
  AppointmentStatus,
  DatedAvailability,
  DoctorProfile,
  Patient,
  PatientSummary,
  ProfileDraft,
  ScheduleBlock,
  ScheduleDay,
  VisitOutcome,
} from './doctor.models';

export type DatedAvailabilityRefusal =
  'invalid-date' | 'in-the-past' | 'bad-session' | 'overlapping-sessions';

/** A status that ends an appointment's life, so it can no longer be acted on. */
const CLOSED_STATUSES: readonly AppointmentStatus[] = ['completed', 'cancelled', 'no-show'];

/** Statuses that mean the patient is expected to turn up. */
const LIVE_STATUSES: readonly AppointmentStatus[] = ['booked', 'confirmed'];

const byStart = (a: Appointment, b: Appointment): number => a.startsAt.localeCompare(b.startsAt);

/** Most recent first, for a record of what has already happened. */
const byStartNewest = (a: Appointment, b: Appointment): number => byStart(b, a);

/** Minutes across a set of sessions, ignoring any block that cannot be used. */
function sumMinutes(blocks: readonly ScheduleBlock[]): number {
  return blocks.reduce((total, block) => total + (blockMinutes(block) ?? 0), 0);
}

/** Whether two sessions in a day claim the same time. */
function sessionsOverlap(sessions: readonly ScheduleBlock[]): boolean {
  return sessions.some((block, i) =>
    sessions.slice(i + 1).some((other) => {
      const aStart = minutesOfDay(block.startTime)!;
      const aEnd = minutesOfDay(block.endTime)!;
      const bStart = minutesOfDay(other.startTime)!;
      const bEnd = minutesOfDay(other.endTime)!;
      return aStart < bEnd && bStart < aEnd;
    }),
  );
}

const EMPTY_PROFILE: DoctorProfile = {
  id: '',
  name: '',
  email: '',
  specialization: '',
  licenseNumber: '',
  joinedOn: '',
  bio: '',
};

/**
 * Doctor session backed by the real Ktor API.
 *
 * Fetches profile, appointments, schedule and dated availability on init,
 * keeps them in signals, and every page keeps working exactly as before
 * because all the computeds and mutation methods have the same shape —
 * they just read/write API-backed signals instead of in-memory fixtures.
 *
 * Mutations go to the API first and update signals optimistically, so the
 * UI stays responsive while the server confirms.
 */
@Injectable()
export class DoctorSession {
  private readonly gateway = inject(HttpPatientGateway);

  private readonly profileState = signal<DoctorProfile>(EMPTY_PROFILE);
  private readonly appointmentState = signal<Appointment[]>([]);
  private readonly patientState = signal<Patient[]>([]);
  private readonly scheduleState = signal<ScheduleDay[]>([]);
  private readonly datedAvailabilityState = signal<DatedAvailability[]>([]);

  /**
   * The area's single clock.
   *
   * A signal rather than `new Date()` inside the computeds: a `computed` that
   * read the wall clock would be correct only for the first read and cached
   * forever after, so an app left open across midnight would keep showing
   * yesterday.
   */
  readonly now = signal(new Date());

  /**
   * The signed-in doctor's id.
   *
   * Resolved from the profile the auth service holds. While it is missing the
   * session reads as empty rather than inventing an id.
   */
  readonly doctorId = computed(() => this.profileState().id ?? null);

  readonly profile = computed(() => this.profileState());

  /** The signed-in doctor's appointments, soonest first. */
  readonly appointments = computed(() => this.appointmentState().sort(byStart));

  /** The appointments still to happen: booked and confirmed, soonest first. */
  readonly openAppointments = computed(() =>
    this.appointments().filter((appointment) => LIVE_STATUSES.includes(appointment.status)),
  );

  /** Today's slice of the working list, so the day reads as a plan. */
  readonly todaysAppointments = computed(() => {
    const now = this.now();
    return this.openAppointments().filter((appointment) =>
      isSameDay(new Date(appointment.startsAt), now),
    );
  });

  /** Visits this doctor has already recorded: completed and no-show, newest first. */
  readonly visitHistory = computed(() =>
    this.appointments()
      .filter(
        (appointment) => appointment.status === 'completed' || appointment.status === 'no-show',
      )
      .sort(byStartNewest),
  );

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

  /** Patients this doctor has seen or is due to see. */
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
          (appointment) =>
            appointment.status !== 'cancelled' && new Date(appointment.startsAt).getTime() < now,
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

  /** Days the doctor publishes any hours for, for the schedule summary. */
  readonly workingDayCount = computed(
    () => this.scheduleState().filter((day) => day.sessions.length > 0).length,
  );

  /** Minutes the doctor publishes per week, for the schedule summary. */
  readonly weeklyMinutes = computed(() =>
    this.scheduleState().reduce((total, day) => total + sumMinutes(day.sessions), 0),
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
    return this.appointments().filter(
      (appointment) => appointment.patientId === patientId && appointment.status !== 'cancelled',
    );
  }

  /** Name for a table cell, so a missing patient never renders as `undefined`. */
  patientName(patientId: string): string {
    return this.patientById(patientId)?.name ?? 'Unknown patient';
  }

  /**
   * Records what happened at a visit the doctor has now seen.
   *
   * The Doctor area's entire authority over an appointment, and deliberately the
   * only lever this store offers over one. Refuses an appointment that is not
   * `confirmed`, because that step belongs to the front desk.
   */
  recordOutcome(id: string, outcome: VisitOutcome): boolean {
    const current = this.appointmentState().find(
      (appointment) => appointment.id === id && appointment.doctorId === this.doctorId(),
    );
    if (!current || current.status !== 'confirmed') return false;

    this.appointmentState.update((appointments) =>
      appointments.map((appointment) =>
        appointment.id === id ? { ...appointment, status: outcome } : appointment,
      ),
    );

    this.gateway.recordAppointmentOutcome(id, outcome).subscribe({
      error: () => {
        // Roll back optimistically if the server rejects it.
        this.appointmentState.update((appointments) =>
          appointments.map((appointment) =>
            appointment.id === id ? { ...appointment, status: 'confirmed' } : appointment,
          ),
        );
      },
    });
    return true;
  }

  /**
   * Confirms a booking, moving it from `booked` to `confirmed`.
   *
   * Refuses an appointment that is not `booked` — only a booking can be
   * confirmed, and a confirmed appointment is already past that step.
   */
  confirmAppointment(id: string): boolean {
    const current = this.appointmentState().find(
      (appointment) => appointment.id === id && appointment.doctorId === this.doctorId(),
    );
    if (!current || current.status !== 'booked') return false;

    this.appointmentState.update((appointments) =>
      appointments.map((appointment) =>
        appointment.id === id ? { ...appointment, status: 'confirmed' } : appointment,
      ),
    );

    this.gateway.confirmAppointment(id).subscribe({
      error: () => {
        // Roll back optimistically if the server rejects it.
        this.appointmentState.update((appointments) =>
          appointments.map((appointment) =>
            appointment.id === id ? { ...appointment, status: 'booked' } : appointment,
          ),
        );
      },
    });
    return true;
  }

  /**
   * Replaces the published availability with a saved week.
   */
  saveSchedule(days: readonly ScheduleDay[]): void {
    this.scheduleState.set(
      days.map((day) => ({ dayOfWeek: day.dayOfWeek, sessions: usableBlocks(day.sessions) })),
    );

    this.gateway.saveDoctorSchedule(this.doctorId() ?? '', this.scheduleState()).subscribe({
      error: () => {
        // Roll back: re-fetch from server on error.
        this.gateway.getDoctorSchedule(this.doctorId() ?? '').subscribe({
          next: (days) => this.scheduleState.set(days),
          error: () => {},
        });
      },
    });
  }

  /**
   * Dated overrides, soonest first.
   */
  readonly datedAvailability = computed(() =>
    [...this.datedAvailabilityState()].sort((a, b) => a.date.localeCompare(b.date)),
  );

  /**
   * The sessions in force on one date, in clock order.
   */
  sessionsOn(date: Date): readonly ScheduleBlock[] {
    const key = dayKey(date);
    const override = this.datedAvailabilityState().find((entry) => entry.date === key);
    const weekly = this.scheduleState().find((day) => day.dayOfWeek === date.getDay());
    return usableBlocks(override ? override.sessions : (weekly?.sessions ?? []));
  }

  /**
   * Whether an appointment may be booked into a session.
   */
  fitsInSession(date: Date, startMinutes: number, durationMinutes: number): boolean {
    const endMinutes = startMinutes + durationMinutes;
    return this.sessionsOn(date).some((block) => {
      const open = minutesOfDay(block.startTime);
      const close = minutesOfDay(block.endTime);
      if (open === null || close === null) return false;
      return startMinutes >= open && endMinutes <= close;
    });
  }

  /**
   * Publishes one dated override.
   */
  saveDatedAvailability(entry: DatedAvailability): DatedAvailabilityRefusal | null {
    const date = parseDayKey(entry.date);
    if (!date) return 'invalid-date';
    if (date.getTime() < startOfDay(this.now()).getTime()) return 'in-the-past';

    const sessions = usableBlocks(entry.sessions);
    if (sessions.length !== entry.sessions.length) return 'bad-session';
    if (sessionsOverlap(sessions)) return 'overlapping-sessions';

    const key = dayKey(date);
    this.datedAvailabilityState.update((entries) => [
      ...entries.filter((existing) => existing.date !== key),
      { date: key, sessions },
    ]);

    this.gateway.saveDoctorAvailability(this.doctorId() ?? '', entry).subscribe({
      error: () => {
        this.datedAvailabilityState.update((entries) => entries.filter((e) => e.date !== key));
      },
    });
    return null;
  }

  /**
   * Withdraws a dated override, putting that date back on the weekly pattern.
   */
  clearDatedAvailability(date: string): boolean {
    const before = this.datedAvailabilityState().length;
    this.datedAvailabilityState.update((entries) => entries.filter((e) => e.date !== date));

    this.gateway
      .saveDoctorAvailability(this.doctorId() ?? '', {
        date,
        sessions: [],
      })
      .subscribe({
        error: () => {
          // Re-fetch to restore previous state.
          this.gateway.getDoctorAvailability(this.doctorId() ?? '').subscribe({
            next: (entries) => this.datedAvailabilityState.set(entries),
            error: () => {},
          });
        },
      });
    return this.datedAvailabilityState().length !== before;
  }

  /**
   * Applies the fields the Profile page is allowed to change.
   */
  updateProfile(draft: ProfileDraft): void {
    this.profileState.update((profile) => {
      if (!profile) return profile;
      return {
        ...profile,
        name: draft.name,
        email: draft.email,
        bio: draft.bio,
      };
    });

    this.gateway.updateProfile(draft as any).subscribe({
      error: () => {},
    });
  }

  // ---------------------------------------------------------------------------
  // Initial load from the API
  // ---------------------------------------------------------------------------
  constructor() {
    // Profile first — everything else needs the doctor id.
    this.gateway.getProfile().pipe(
      switchMap((profile) =>
        this.gateway.getDoctor(profile.id).pipe(
          map((doctor) => ({ profile, doctor })),
        ),
      ),
    ).subscribe({
      next: ({ profile, doctor }) => {
        this.profileState.set({
          id: profile.id,
          name: profile.fullName,
          email: profile.email ?? '',
          specialization: doctor.specialty,
          licenseNumber: doctor.licenseNumber,
          joinedOn: profile.joinedOn ?? '',
          bio: doctor.bio,
        });
      },
      error: () => {
        // Doctor record may not exist yet; fall back to profile-only data.
        this.gateway.getProfile().subscribe({
          next: (profile) => {
            this.profileState.set({
              id: profile.id,
              name: profile.fullName,
              email: profile.email ?? '',
              specialization: '',
              licenseNumber: '',
              joinedOn: profile.joinedOn ?? '',
              bio: '',
            });
          },
          error: () => {},
        });
      },
    });

    // Appointments for this doctor — filtered server-side by doctorId.
    this.gateway.getDoctorAppointments().subscribe({
      next: (paged) => this.appointmentState.set((paged.items ?? []) as unknown as Appointment[]),
      error: () => {},
    });

    // Patients with appointments for this doctor.
    this.gateway.getPatients().subscribe({
      next: (profiles: UserProfile[]) =>
        this.patientState.set(
          profiles.map((p) => ({
            id: p.id,
            name: p.fullName,
            email: p.email ?? '',
            phone: p.mobileNumber ?? '',
            dateOfBirth: p.dateOfBirth,
            address: '',
            registeredOn: p.dateOfBirth,
            status: p.status as AccountStatus,
          })) as Patient[],
        ),
      error: () => {},
    });
  }
}
