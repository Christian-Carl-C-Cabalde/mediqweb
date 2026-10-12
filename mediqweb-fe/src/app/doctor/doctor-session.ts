import { Injectable, computed, signal } from '@angular/core';
import {
  blockMinutes,
  dayKey,
  isSameDay,
  minutesOfDay,
  parseDayKey,
  startOfDay,
  usableBlocks,
} from './doctor.dates';
import {
  MOCK_APPOINTMENTS,
  MOCK_DATED_AVAILABILITY,
  MOCK_DOCTOR_PROFILE,
  MOCK_PATIENTS,
  MOCK_SCHEDULE,
  SIGNED_IN_DOCTOR_ID,
} from './doctor.mock-data';
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

/** A status that ends an appointment's life, so it can no longer be acted on. */
const CLOSED_STATUSES: readonly AppointmentStatus[] = ['completed', 'cancelled', 'no-show'];

/** Statuses that mean the patient is expected to turn up. */
const LIVE_STATUSES: readonly AppointmentStatus[] = ['booked', 'confirmed'];

/**
 * Why a dated override was not published, or `null` when it was.
 *
 * A reason rather than a boolean, for the same reason `BookingRefusal` is: the
 * page has to say *why* nothing was saved, and "no" is not a sentence. Kept as
 * data so the wording lives with the rule and a new refusal cannot be added
 * without the page being forced to handle it.
 */
export type DatedAvailabilityRefusal =
  'invalid-date' | 'in-the-past' | 'bad-session' | 'overlapping-sessions';

const byStart = (a: Appointment, b: Appointment): number => a.startsAt.localeCompare(b.startsAt);

/** Most recent first, for a record of what has already happened. */
const byStartNewest = (a: Appointment, b: Appointment): number => byStart(b, a);

/** Minutes across a set of sessions, ignoring any block that cannot be used. */
function sumMinutes(blocks: readonly ScheduleBlock[]): number {
  return blocks.reduce((total, block) => total + (blockMinutes(block) ?? 0), 0);
}

/**
 * Whether two sessions in a day claim the same time.
 *
 * Half-open, so a session ending at 12:00 and one starting at 12:00 do not
 * overlap — they are the two halves of a split day, and treating them as a clash
 * would make the ordinary case unsavable.
 *
 * Only worth asking once there is more than one session per day, which is exactly
 * what the split-day shape introduced.
 */
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
  private readonly datedAvailabilityState = signal<DatedAvailability[]>(
    MOCK_DATED_AVAILABILITY.map((entry) => ({ ...entry })),
  );
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

  /**
   * The appointments still to happen: booked and confirmed, soonest first.
   *
   * The Doctor area's working list, and deliberately the *only* one. A visit this
   * doctor has already recorded is a fact about the past and belongs on
   * `visitHistory`; a cancelled appointment is not the doctor's record at all,
   * because calling one off is the Secretary's decision and their history holds
   * it. Listing all three together put twelve finished rows above the nine that
   * needed something done, and the finished ones were never the reason anyone
   * opened the page.
   *
   * `LIVE_STATUSES` rather than a hand-written pair, so this stays "not finished"
   * as statuses are added instead of quietly dropping the next one.
   */
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

  /**
   * Visits this doctor has already recorded: completed and no-show, newest first.
   *
   * `cancelled` is deliberately absent even though it shares `CLOSED_STATUSES`
   * with the other two. Nobody was seen and nobody failed to attend — a cancelled
   * booking is an administrative event, not a visit, and counting one as a
   * consultation would overstate the work this doctor has done. The rule lives
   * here rather than in the History page so the page and any future report
   * cannot disagree about what a visit was.
   */
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

  /**
   * Patients this doctor has seen or is due to see.
   *
   * Derived from the appointments rather than read from `patientState`
   * directly, which is what keeps an unrelated patient out of the list.
   *
   * `lastVisit` skips cancellations, on the same rule as `visitHistory`: the
   * column is headed "Last visit" and the date beside it is read as a day this
   * doctor saw somebody. A booking the front desk called off was nobody being
   * seen, so showing its date there would have the column answer a question
   * about consultations with the answer from the appointment book.
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

  /**
   * Minutes the doctor publishes per week, for the schedule summary.
   *
   * Sums every session, so a split day contributes both of its halves. A day
   * that is closed contributes nothing, which is now simply what an empty
   * session list means.
   */
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

  /**
   * A patient's appointments with this doctor, soonest first.
   *
   * Cancellations are dropped, on the same rule as the working list: calling an
   * appointment off is the Secretary's decision and it lives on their history, so
   * this doctor's record of a patient is what happened at the visits and what is
   * still booked — not what the front desk called off. A patient page that showed
   * cancellations while the Appointments page did not would make the same record
   * mean two different things depending on where it was read.
   */
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
   * only lever this store offers over one. It was `setAppointmentStatus(id,
   * status)` taking any status, which meant the buttons on screen were the *only*
   * thing stopping a doctor confirming their own booking or calling one off — and
   * a view that merely hides a control still lets a caller reach the same result.
   * Naming the two outcomes instead of the five statuses makes the capability a
   * type rather than a convention.
   *
   * Refuses an appointment that is not `confirmed`, because that step belongs to
   * the front desk: a doctor recording an outcome on a booking nobody has approved
   * would skip past the approval rather than record anything.
   *
   * That precondition also covers the double click on its own, so there is no
   * separate "already holds this status" check: a `confirmed` appointment can
   * never already be `completed` or `no-show`, and TypeScript says so.
   *
   * Also ignores an unknown id and another doctor's appointment, so a guessed id
   * cannot reach across the scoping rule. Returns whether anything changed, which
   * is what the caller reports from.
   */
  recordOutcome(id: string, outcome: VisitOutcome): boolean {
    const current = this.appointmentState().find(
      (appointment) => appointment.id === id && appointment.doctorId === this.doctorId,
    );
    if (!current || current.status !== 'confirmed') return false;

    this.appointmentState.update((appointments) =>
      appointments.map((appointment) =>
        appointment.id === id ? { ...appointment, status: outcome } : appointment,
      ),
    );
    return true;
  }

  /**
   * Replaces the published availability with a saved week.
   *
   * Drops any session that cannot be used, and keeps days whose sessions do not
   * overlap. The form validates both before it gets here; this is the store
   * refusing to publish a schedule that could not be booked against, which is the
   * same reason the page's checks are not the only line of defence.
   */
  saveSchedule(days: readonly ScheduleDay[]): void {
    this.scheduleState.set(
      days.map((day) => ({ dayOfWeek: day.dayOfWeek, sessions: usableBlocks(day.sessions) })),
    );
  }

  /**
   * Dated overrides, soonest first.
   *
   * Sorted by date rather than by insertion order because that is the order a
   * clinician reads them in: the exceptions nearest today are the ones about to
   * matter, and an unsorted list would bury a closure under next year's.
   */
  readonly datedAvailability = computed(() =>
    [...this.datedAvailabilityState()].sort((a, b) => a.date.localeCompare(b.date)),
  );

  /**
   * The sessions in force on one date, in clock order.
   *
   * The single answer to "is the doctor working on this day, and when". A dated
   * entry wins over the weekly pattern for its own date and no other, so the
   * answer to that question lives in one place instead of being re-derived by
   * every screen that needs it — the kind of duplication that produces a booking
   * form disagreeing with the schedule it is supposedly enforcing.
   *
   * Falls back to the week's entry, which is what makes an override mean
   * "replaces the pattern for that day" rather than "adds to it".
   */
  sessionsOn(date: Date): readonly ScheduleBlock[] {
    const key = dayKey(date);
    const override = this.datedAvailabilityState().find((entry) => entry.date === key);
    const weekly = this.scheduleState().find((day) => day.dayOfWeek === date.getDay());
    return usableBlocks(override ? override.sessions : (weekly?.sessions ?? []));
  }

  /**
   * Whether an appointment may be booked into a session.
   *
   * `durationMinutes` is checked against the session's own end rather than the
   * day's, which is the whole reason this takes a session: a 30 minute
   * appointment starting at 09:45 must be refused by the morning block even
   * though the afternoon block would have had room, and a day's single `close`
   * could not tell the difference.
   *
   * The session must contain the visit entirely — half-open at the boundaries,
   * so a booking may start exactly when a session opens and end exactly when one
   * closes, but never straddle the gap between two sessions.
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
   *
   * Rejects a date that has already passed, and an entry whose sessions overlap
   * or run backwards, reporting which rather than returning a bare false — the
   * page needs to say *why* nothing was saved, and "no" is not a sentence.
   *
   * An entry with no sessions is a closed date and is allowed: a holiday is a
   * real thing to publish, and refusing it would leave a working weekday looking
   * open.
   *
   * An existing entry for the same date is replaced rather than refused. Two
   * records for one date would leave "which hours apply" ambiguous, and silently
   * keeping the older one would mean a correction appeared to do nothing.
   *
   * This method does not touch appointments already booked on that date. The
   * same reason the weekly form does not: moving a doctor's hours is not the
   * same decision as moving a patient's visit, and only a Secretary at the desk
   * can do the second.
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
    return null;
  }

  /**
   * Withdraws a dated override, putting that date back on the weekly pattern.
   *
   * Reports whether one was removed, so a caller that guessed a date — or double
   * clicked — is not told it withdrew something that was not there.
   */
  clearDatedAvailability(date: string): boolean {
    const before = this.datedAvailabilityState().length;
    this.datedAvailabilityState.update((entries) => entries.filter((e) => e.date !== date));
    return this.datedAvailabilityState().length !== before;
  }

  /**
   * Applies the fields the Profile page is allowed to change.
   *
   * Named field by field rather than spread, so a caller handing over a whole
   * profile object cannot reassign the doctor through it. The type already limits
   * `ProfileDraft` to three fields, but a spread would make that a compile-time
   * suggestion rather than a rule — and it is the same reasoning that took the
   * contact number out in the first place.
   */
  updateProfile(draft: ProfileDraft): void {
    this.profileState.update((profile) => ({
      ...profile,
      name: draft.name,
      email: draft.email,
      bio: draft.bio,
    }));
  }
}
