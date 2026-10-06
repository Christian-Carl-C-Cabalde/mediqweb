import { Injectable, computed, signal } from '@angular/core';
import { isSameDay, localIso, minutesOfDay, shortDate, startOfDay } from './secretary.dates';
import {
  MOCK_APPOINTMENTS,
  MOCK_CONVERSATIONS,
  MOCK_DOCTORS,
  MOCK_MESSAGES,
  MOCK_PATIENTS,
  MOCK_SCHEDULES,
  MOCK_SECRETARY_PROFILE,
  SIGNED_IN_SECRETARY_ID,
} from './secretary.mock-data';
import type {
  Appointment,
  AppointmentStatus,
  Conversation,
  ConversationMessage,
  ConversationSummary,
  Doctor,
  DoctorSummary,
  Patient,
  PatientSummary,
  ProfileDraft,
  ScheduleDay,
  SecretaryProfile,
} from './secretary.models';

/** A status that ends an appointment's life, so it can no longer be acted on. */
const CLOSED_STATUSES: readonly AppointmentStatus[] = ['completed', 'cancelled', 'no-show'];

/** Statuses that mean the patient is expected to turn up. */
const LIVE_STATUSES: readonly AppointmentStatus[] = ['booked', 'confirmed'];

const byStart = (a: Appointment, b: Appointment): number => a.startsAt.localeCompare(b.startsAt);

/** A proposed booking, before it exists as an appointment. */
export interface BookingDraft {
  readonly patientId: string;
  readonly doctorId: string;
  /** Zone-less local timestamp, `YYYY-MM-DDTHH:MM:SS`. */
  readonly startsAt: string;
  readonly durationMinutes: number;
  readonly reason: string;
}

/**
 * Why a proposed booking cannot go ahead, or `null` when it can.
 *
 * Returned as a sentence rather than a code so the booking form can show it
 * directly — the alternative is a lookup table in the template that will drift
 * out of step with the rules the store enforces.
 */
export type BookingRefusal =
  | 'no-patient'
  | 'no-doctor'
  | 'inactive-doctor'
  | 'day-closed'
  | 'outside-hours'
  | 'ends-after-close'
  | 'doctor-busy'
  | 'not-in-the-future';

/**
 * In-memory stand-in for the Secretary API.
 *
 * Every screen in the Secretary area reads from here, so the whole area can be
 * exercised end to end without a backend. Replacing this with a service that
 * talks to the API is the only change the screens should ever need.
 *
 * Unlike `DoctorSession`, nothing here is scoped to one provider: a Secretary
 * books for the whole clinic and may see every patient, doctor and appointment.
 * What *is* enforced here is the set of rules that decide whether a booking is
 * allowed to exist — inside the doctor's published hours, not clashing with
 * another of that doctor's appointments, and not for a doctor who is inactive.
 * Those rules belong here rather than in a template because they are about the
 * data, not about how it looks: a form that merely turned the submit button grey
 * would still let a caller reach the same result by calling the store.
 */
@Injectable()
export class SecretarySession {
  private readonly appointmentState = signal<Appointment[]>([...MOCK_APPOINTMENTS]);
  private readonly patientState = signal<Patient[]>([...MOCK_PATIENTS]);
  private readonly doctorState = signal<Doctor[]>([...MOCK_DOCTORS]);
  private readonly scheduleState = signal<Record<string, ScheduleDay[]>>(
    Object.fromEntries(
      Object.entries(MOCK_SCHEDULES).map(([id, days]) => [id, days.map((day) => ({ ...day }))]),
    ),
  );
  private readonly profileState = signal<SecretaryProfile>({ ...MOCK_SECRETARY_PROFILE });
  private readonly conversationState = signal<Conversation[]>(
    MOCK_CONVERSATIONS.map((conversation) => ({ ...conversation })),
  );
  private readonly messageState = signal<ConversationMessage[]>(
    MOCK_MESSAGES.map((message) => ({ ...message })),
  );

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

  readonly secretaryId = SIGNED_IN_SECRETARY_ID;

  readonly profile = computed(() => this.profileState());

  /** Every appointment in the clinic, soonest first. */
  readonly appointments = computed(() => [...this.appointmentState()].sort(byStart));

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

  /** Booked but not yet confirmed by the patient — the queue needing a reminder. */
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
   * Every patient the clinic has, with their visit figures.
   *
   * A Secretary sees all of them: they are the one who opens a patient record in
   * order to book, so a patient with no appointments yet still has to be
   * reachable. That is the opposite of the Doctor area, where a patient is only
   * visible once they have an appointment with that doctor.
   */
  readonly patients = computed<PatientSummary[]>(() => {
    const all = this.appointments();
    const now = this.now().getTime();

    return this.patientState().map((patient): PatientSummary => {
      const history = all
        .filter((appointment) => appointment.patientId === patient.id)
        .sort(byStart);
      const past = history.filter((appointment) => new Date(appointment.startsAt).getTime() < now);
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
    });
  });

  /** Every doctor, with the availability the Secretary needs when booking. */
  readonly doctors = computed<DoctorSummary[]>(() => {
    const now = this.now().getTime();
    return this.doctorState().map((doctor) => {
      const days = this.schedule()[doctor.id] ?? [];
      const weekly = days.reduce((total, day) => total + this.dayMinutes(day), 0);
      const nextLive = this.appointments()
        .filter(
          (appointment) =>
            appointment.doctorId === doctor.id &&
            LIVE_STATUSES.includes(appointment.status) &&
            new Date(appointment.startsAt).getTime() >= now,
        )
        .sort(byStart)[0];

      return {
        doctor,
        weeklyHours: weekly ? formatWeekHours(weekly) : 'Not taking bookings',
        nextAvailable: nextLive?.startsAt ?? null,
      };
    });
  });

  readonly activeDoctorCount = computed(
    () => this.doctorState().filter((doctor) => doctor.status === 'active').length,
  );

  /** Each doctor's published week, sorted Sunday-first. */
  readonly schedule = computed(() =>
    Object.fromEntries(
      Object.entries(this.scheduleState()).map(([id, days]) => [
        id,
        [...days].sort((a, b) => a.dayOfWeek - b.dayOfWeek),
      ]),
    ),
  );

  // -------------------------------------------------------------------------
  // Messaging
  // -------------------------------------------------------------------------

  /**
   * Every thread, most recently active first.
   *
   * Sorted here rather than in the page so the nav badge and the list are
   * counting and ordering the same set — two independent orderings is how a
   * badge ends up promising a conversation that is not at the top.
   *
   * An empty thread sorts last because its `lastSentAt` is `''`, which is also
   * what the list row renders as "No messages yet". The fixtures all have
   * messages; the shape has to survive one that does not.
   */
  readonly conversations = computed<ConversationSummary[]>(() => {
    const messages = this.messageState();

    return this.conversationState()
      .map((conversation): ConversationSummary => {
        const thread = messages
          .filter((message) => message.conversationId === conversation.id)
          .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
        const newest = thread[thread.length - 1];

        return {
          conversation,
          name: this.partyName(conversation),
          messages: thread,
          unreadCount: thread.filter((m) => !m.fromSecretary && m.readAt === null).length,
          lastSentAt: newest?.sentAt ?? '',
          preview: newest ? oneline(newest.body) : '',
          lastFromSecretary: newest?.fromSecretary ?? true,
        };
      })
      .sort((a, b) => b.lastSentAt.localeCompare(a.lastSentAt));
  });

  /** Messages waiting to be read, across every thread. */
  readonly unreadMessageCount = computed(() =>
    this.conversations().reduce((total, summary) => total + summary.unreadCount, 0),
  );

  /** How many threads still owe the clinic something. */
  readonly awaitingActionCount = computed(
    () => this.conversationState().filter((conversation) => conversation.awaitingAction).length,
  );

  /**
   * One thread, or `null` for an id that matches none.
   *
   * Tolerating a bad id rather than throwing is the same contract as
   * `patientById`: the screen asks for a conversation and renders what it got,
   * rather than an unreachable id blanking the page.
   */
  conversationById(id: string): ConversationSummary | null {
    return this.conversations().find((summary) => summary.conversation.id === id) ?? null;
  }

  /**
   * The line under a name in the thread header.
   *
   * Answers "who am I actually talking to" from data the clinic already holds
   * rather than from a label typed into the thread — a doctor's specialty, or how
   * many times a patient has actually been seen.
   */
  conversationSubtitle(conversation: Conversation): string {
    if (conversation.party === 'doctor') {
      const doctor = this.doctorById(conversation.partyId);
      return doctor ? `Doctor · ${doctor.specialization}` : 'Doctor';
    }

    const summary = this.patients().find((entry) => entry.patient.id === conversation.partyId);
    if (!summary) return 'Patient';

    // A booking first, because "has this person been in before?" is the wrong
    // question for somebody who is already on the schedule — and `visitCount`
    // counts only completed and missed appointments, so a patient with a confirmed
    // appointment for next week reads as "New patient", which is both wrong and
    // the kind of thing that gets said out loud to them.
    if (summary.nextVisit) {
      return `Patient · Next visit ${shortDate(new Date(summary.nextVisit.startsAt))}`;
    }
    return summary.visitCount
      ? `Patient · ${summary.visitCount} visit${summary.visitCount === 1 ? '' : 's'}`
      : 'Patient · Not yet seen';
  }

  /**
   * Marks everything the other party sent in a thread as read.
   *
   * Only their messages: a reply you sent yourself is never unread, and marking
   * it so would inflate the count back on the next read. Returns whether anything
   * changed, so the caller can tell a real transition from a no-op.
   */
  markConversationRead(conversationId: string): boolean {
    const at = localIso(this.now());
    let changed = false;

    this.messageState.update((messages) =>
      messages.map((message) => {
        if (message.conversationId !== conversationId) return message;
        if (message.fromSecretary || message.readAt !== null) return message;
        changed = true;
        return { ...message, readAt: at };
      }),
    );

    return changed;
  }

  /**
   * Appends a reply from the signed-in Secretary.
   *
   * Returns the new message, or `null` for an empty body or an unknown thread —
   * so the composer can clear itself only when something was actually sent,
   * instead of silently eating what somebody typed.
   */
  sendMessage(conversationId: string, body: string): ConversationMessage | null {
    const text = body.trim();
    if (!text) return null;
    if (!this.conversationState().some((c) => c.id === conversationId)) return null;

    const message: ConversationMessage = {
      id: this.nextMessageId(),
      conversationId,
      sentAt: localIso(this.now()),
      body: text,
      fromSecretary: true,
      // Read by definition: you wrote it.
      readAt: localIso(this.now()),
    };

    this.messageState.update((messages) => [...messages, message]);
    return message;
  }

  /**
   * An id no fixture has taken.
   *
   * Checked against the live list rather than the fixtures, for the same reason
   * as `nextAppointmentId`: two replies in a session must not collide.
   */
  private nextMessageId(): string {
    const used = this.messageState().map((message) => message.id);
    let highest = 0;
    for (const id of used) {
      const parsed = Number(id.replace('msg-', ''));
      if (Number.isFinite(parsed) && parsed > highest) highest = parsed;
    }
    return `msg-${String(highest + 1).padStart(4, '0')}`;
  }

  /**
   * A conversation's name, from the patient or doctor fixtures.
   *
   * A thread can only name somebody the clinic actually has, so an unknown id
   * says so in the same words as `patientName` rather than rendering blank.
   */
  private partyName(conversation: Conversation): string {
    return conversation.party === 'doctor'
      ? (this.doctorById(conversation.partyId)?.name ?? 'Unknown doctor')
      : (this.patientById(conversation.partyId)?.name ?? 'Unknown patient');
  }

  /** Patient lookup that tolerates a bad route param instead of throwing. */
  patientById(id: string): Patient | null {
    return this.patientState().find((patient) => patient.id === id) ?? null;
  }

  doctorById(id: string): Doctor | null {
    return this.doctorState().find((doctor) => doctor.id === id) ?? null;
  }

  /** A patient's appointments across all doctors, soonest first. */
  appointmentsForPatient(patientId: string): Appointment[] {
    return this.appointments().filter((appointment) => appointment.patientId === patientId);
  }

  /** A doctor's appointments across every patient, soonest first. */
  appointmentsForDoctor(doctorId: string): Appointment[] {
    return this.appointments().filter((appointment) => appointment.doctorId === doctorId);
  }

  /** Name for a table cell, so a missing patient never renders as `undefined`. */
  patientName(patientId: string): string {
    return this.patientById(patientId)?.name ?? 'Unknown patient';
  }

  /** Name for a table cell, so a missing doctor never renders as `undefined`. */
  doctorName(doctorId: string): string {
    return this.doctorById(doctorId)?.name ?? 'Unknown doctor';
  }

  /** A doctor's published week, or an empty list rather than a throw. */
  scheduleFor(doctorId: string): ScheduleDay[] {
    return this.schedule()[doctorId] ?? [];
  }

  /** Minutes published on one day, or zero when the day is closed or invalid. */
  dayMinutes(day: ScheduleDay): number {
    if (!day.enabled) return 0;
    const start = minutesOfDay(day.startTime);
    const end = minutesOfDay(day.endTime);
    if (start === null || end === null || end <= start) return 0;
    return end - start;
  }

  /** Minutes a doctor publishes across the whole week. */
  weeklyMinutes(doctorId: string): number {
    return this.scheduleFor(doctorId).reduce((total, day) => total + this.dayMinutes(day), 0);
  }

  /**
   * Whether a proposed booking is allowed, and why not if it is not.
   *
   * Shared by the booking form (to disable submit and explain) and by `book`
   * (which refuses the same way), so the two can never disagree — the alternative
   * is a form that disables a button for a rule the store does not share, and
   * the button turns out to be wrong the first time the rule is edited.
   *
   * `ignoreId` is the appointment being rescheduled, so moving an appointment
   * onto its own current slot is not treated as a clash with itself.
   */
  bookingRefusal(draft: BookingDraft, ignoreId?: string): BookingRefusal | null {
    if (!draft.patientId || !this.patientById(draft.patientId)) return 'no-patient';

    const doctor = this.doctorById(draft.doctorId);
    if (!doctor) return 'no-doctor';
    if (doctor.status !== 'active') return 'inactive-doctor';

    const startsAt = new Date(draft.startsAt);
    if (Number.isNaN(startsAt.getTime())) return 'not-in-the-future';
    if (startsAt.getTime() < this.now().getTime()) return 'not-in-the-future';

    const day = this.scheduleFor(draft.doctorId).find((d) => d.dayOfWeek === startsAt.getDay());
    if (!day?.enabled) return 'day-closed';

    const open = minutesOfDay(day.startTime);
    const close = minutesOfDay(day.endTime);
    const startMinutes = startsAt.getHours() * 60 + startsAt.getMinutes();
    if (open === null || close === null || startMinutes < open) return 'outside-hours';
    if (startMinutes + draft.durationMinutes > close) return 'ends-after-close';

    const clash = this.appointments().some((appointment) => {
      if (appointment.id === ignoreId) return false;
      if (appointment.doctorId !== draft.doctorId) return false;
      if (CLOSED_STATUSES.includes(appointment.status)) return false;

      const existingStart = new Date(appointment.startsAt).getTime();
      const existingEnd = existingStart + appointment.durationMinutes * 60_000;
      const proposedStart = startsAt.getTime();
      const proposedEnd = proposedStart + draft.durationMinutes * 60_000;
      // Half-open intervals: a booking may start exactly when another ends.
      return proposedStart < existingEnd && existingStart < proposedEnd;
    });
    if (clash) return 'doctor-busy';

    return null;
  }

  /**
   * Books a new appointment.
   *
   * Applies the same rules the booking form checks, so a caller cannot get round
   * them. Returns the new appointment, or `null` when the booking was refused —
   * the caller asks `bookingRefusal` for the reason to show.
   */
  book(draft: BookingDraft): Appointment | null {
    if (this.bookingRefusal(draft)) return null;

    const appointment: Appointment = {
      id: this.nextAppointmentId(),
      patientId: draft.patientId,
      doctorId: draft.doctorId,
      startsAt: draft.startsAt,
      durationMinutes: draft.durationMinutes,
      // A Secretary creates a booking; confirming it is the patient's or the
      // doctor's to do, so a new appointment is never born confirmed.
      status: 'booked',
      reason: draft.reason.trim(),
    };
    this.appointmentState.update((appointments) => [...appointments, appointment]);
    return appointment;
  }

  /**
   * Moves an appointment to a new time, keeping its status.
   *
   * Refuses a move into another appointment's slot or outside the doctor's
   * published hours, on the same terms as a new booking. Cancelled appointments
   * cannot be moved: their time no longer matters, and reviving one silently
   * would make a cancellation reversible without anyone saying so.
   */
  reschedule(id: string, startsAt: string): boolean {
    const current = this.appointmentState().find((appointment) => appointment.id === id);
    if (!current || CLOSED_STATUSES.includes(current.status)) return false;

    if (
      this.bookingRefusal(
        {
          patientId: current.patientId,
          doctorId: current.doctorId,
          startsAt,
          durationMinutes: current.durationMinutes,
          reason: current.reason,
        },
        id,
      )
    ) {
      return false;
    }

    this.appointmentState.update((appointments) =>
      appointments.map((appointment) =>
        appointment.id === id ? { ...appointment, startsAt } : appointment,
      ),
    );
    return true;
  }

  /**
   * Cancels an appointment.
   *
   * The only status the Secretary sets on an existing appointment: confirming,
   * completing and recording a no-show are the doctor's to do. Already-cancelled
   * and already-finished appointments are ignored, so a double click cannot
   * rewrite history. Returns whether anything changed.
   */
  cancel(id: string): boolean {
    const current = this.appointmentState().find((appointment) => appointment.id === id);
    if (!current || CLOSED_STATUSES.includes(current.status)) return false;

    this.appointmentState.update((appointments) =>
      appointments.map((appointment) =>
        appointment.id === id ? { ...appointment, status: 'cancelled' as const } : appointment,
      ),
    );
    return true;
  }

  /** Applies the fields the Profile page is allowed to change. */
  updateProfile(draft: ProfileDraft): void {
    this.profileState.update((profile) => ({ ...profile, ...draft }));
  }

  /**
   * An id no fixture has taken.
   *
   * Sequential and checked against the live list rather than the fixtures, so
   * deleting an appointment during a session cannot hand out a duplicate.
   */
  private nextAppointmentId(): string {
    const used = this.appointmentState().map((appointment) => appointment.id);
    let highest = 200;
    for (const id of used) {
      const parsed = Number(id.replace('appt-', ''));
      if (Number.isFinite(parsed) && parsed > highest) highest = parsed;
    }
    return `appt-${highest + 1}`;
  }
}

/** Minutes to the "6h 30m a week" phrasing the Doctor List shows. */
function formatWeekHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins}m a week`;
  return mins ? `${hours}h ${mins}m a week` : `${hours}h a week`;
}

/**
 * A message body flattened to one line and clipped, for a list row preview.
 *
 * Bodies are written as single lines here but a reply typed into the composer can
 * contain newlines, and a list row is one line tall — so the newline is collapsed
 * here rather than left to CSS `line-clamp`, which would need a height the row
 * does not have. Clipped at a character count rather than a pixel count so the
 * same string previews the same everywhere.
 */
function oneline(body: string, limit = 110): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > limit ? `${flat.slice(0, limit - 1).trimEnd()}…` : flat;
}
