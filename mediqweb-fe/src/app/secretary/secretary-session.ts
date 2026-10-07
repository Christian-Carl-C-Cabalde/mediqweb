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

/**
 * A proposed appointment, before it exists as one.
 *
 * Not something a Secretary can submit any more — they do not create
 * appointments. This is the shape whoever does create one works in, and it is
 * what `bookingRefusal` judges.
 */
export interface BookingDraft {
  readonly patientId: string;
  readonly doctorId: string;
  /** Zone-less local timestamp, `YYYY-MM-DDTHH:MM:SS`. */
  readonly startsAt: string;
  readonly durationMinutes: number;
  readonly reason: string;
}

/**
 * Why a proposed appointment cannot go ahead, or `null` when it can.
 *
 * A code rather than a sentence, because there is no longer a form on this desk
 * to show one in. Whoever creates an appointment — a patient booking online, an
 * administrator — gives the code their own wording; returning a sentence from
 * here would freeze the first form's phrasing into the store.
 *
 * `not-your-doctor` exists because the booking form never offered a doctor at
 * all: the desk is scoped to one. It is still refused, because the store's job is
 * to hold the rule and a form's is to make it hard to break — not the other way
 * round.
 */
export type BookingRefusal =
  | 'no-patient'
  | 'no-doctor'
  | 'not-your-doctor'
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
 * Everything here is scoped to one doctor: the one an administrator assigned this
 * Secretary to. The fixtures stay clinic-wide — there is one clinic, and the other
 * desks have to exist for the scoping to mean anything — but every list, every
 * count and every lookup is filtered through `isOnDesk` before a page can reach
 * it, so a screen cannot accidentally read the clinic by going around a filter.
 *
 * What *is* enforced here, besides the scoping, is the set of rules that decide
 * whether an appointment may change hands: confirming is only ever `booked` to
 * `confirmed`, cancelling only ever closes a live appointment, and neither will
 * touch another desk's record. Those rules belong here rather than in a template
 * because they are about the data, not about how it looks: a view that merely hid
 * the button would still let a caller reach the same result by calling the store.
 *
 * This store creates no appointments. A visit arrives `booked` — from the patient,
 * or from an administrator — and this desk either confirms it or calls it off.
 * `bookingRefusal` still holds the rules a proposed appointment has to satisfy, for
 * whoever creates one, and its tests are what state what the clinic considers
 * bookable.
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

  /**
   * The doctor whose desk this Secretary works, or `null` while unassigned.
   *
   * Public because the screens have to explain the difference: an unassigned
   * desk reads as an empty area on every page, and "nothing booked today" would
   * be a lie. `unassignedMessage` is the sentence they share.
   */
  readonly assignedDoctor = computed<Doctor | null>(() => {
    const id = this.profileState().assignedDoctorId;
    return id ? this.doctorById(id) : null;
  });

  /**
   * What an unassigned desk says for itself.
   *
   * One sentence, one place, because every list in the area would otherwise need
   * its own version of it and they would drift apart.
   */
  readonly unassignedMessage =
    'You are not assigned to a doctor yet. Ask an administrator to assign you to one.';

  /**
   * Whether a record belongs to this Secretary's desk.
   *
   * The one gate every read in this class goes through, and deliberately
   * private: a page that could ask the question itself would eventually ask it
   * wrong, and an unassigned desk has to read as empty everywhere at once rather
   * than on the screens that remembered.
   */
  private isOnDesk(doctorId: string): boolean {
    return this.profileState().assignedDoctorId === doctorId;
  }

  /**
   * Whether a conversation belongs to this desk.
   *
   * Not `isOnDesk(partyId)`: a patient thread's `partyId` is a *patient* id, so
   * comparing it to the assigned doctor would drop every thread with a patient in
   * it and leave the desk with an empty message list while the numbers still
   * looked plausible. Resolving the party first is the only correct reading.
   */
  private isConversationOnDesk(conversation: Conversation): boolean {
    if (conversation.party === 'doctor') return this.isOnDesk(conversation.partyId);
    const patient = this.patientState().find((candidate) => candidate.id === conversation.partyId);
    return !!patient && this.isOnDesk(patient.doctorId);
  }

  /** The assigned doctor's appointments, soonest first. */
  readonly appointments = computed(() =>
    this.appointmentState()
      .filter((appointment) => this.isOnDesk(appointment.doctorId))
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
   * The assigned doctor's patients, with their visit figures.
   *
   * A patient's panel is the reason a Secretary can book somebody they have never
   * met: the list is the assigned doctor's patients, not everybody with an
   * appointment, so a walk-in registered at the desk is on it from the moment they
   * are given to that doctor and stays bookable with no appointment to derive
   * them from.
   *
   * Visit figures come from `appointments`, so they count only what this desk can
   * see. A patient who also saw another doctor reads as having fewer visits here,
   * which is the honest answer for a desk that could not have watched them.
   */
  readonly patients = computed<PatientSummary[]>(() => {
    const all = this.appointments();
    const now = this.now().getTime();

    return this.patientState()
      .filter((patient) => this.isOnDesk(patient.doctorId))
      .map((patient): PatientSummary => {
        const history = all
          .filter((appointment) => appointment.patientId === patient.id)
          .sort(byStart);
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
      });
  });

  /**
   * The assigned doctor, with the availability the Secretary needs when booking.
   *
   * A list rather than a single `Doctor` because that is the shape the Doctor List
   * page and the booking form already read, and because an unassigned desk has to
   * come back as an empty list rather than as a doctor-shaped hole.
   */
  readonly doctors = computed<DoctorSummary[]>(() => {
    const now = this.now().getTime();
    return this.doctorState()
      .filter((doctor) => this.isOnDesk(doctor.id))
      .map((doctor) => {
        const days = this.schedule()[doctor.id] ?? [];
        const weekly = days.reduce((total, day) => total + this.dayMinutes(day), 0);
        // No doctor filter here: `appointments` is already this doctor's, and the
        // loop above it already left only them.
        const nextLive = this.appointments()
          .filter(
            (appointment) =>
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

  /**
   * How many doctors this desk can book with: one, or none while unassigned.
   *
   * Counted off `doctors` rather than the raw fixtures so the number cannot
   * disagree with the roster the page renders beside it.
   */
  readonly activeDoctorCount = computed(
    () => this.doctors().filter((summary) => summary.doctor.status === 'active').length,
  );

  /**
   * The assigned doctor's published week, Sunday-first.
   *
   * One entry, because a schedule is the doctor's own hours: another doctor's week
   * is not this desk's business, and putting it in this record would let it leak
   * into the booking rules. `scheduleFor` returns an empty list for any other id,
   * which is what the schedules page and `bookingRefusal` both want.
   */
  readonly schedule = computed(() =>
    Object.fromEntries(
      Object.entries(this.scheduleState())
        .filter(([id]) => this.isOnDesk(id))
        .map(([id, days]) => [id, [...days].sort((a, b) => a.dayOfWeek - b.dayOfWeek)]),
    ),
  );

  // -------------------------------------------------------------------------
  // Messaging
  // -------------------------------------------------------------------------

  /**
   * This desk's threads, most recently active first.
   *
   * Sorted here rather than in the page so the nav badge and the list are
   * counting and ordering the same set — two independent orderings is how a
   * badge ends up promising a conversation that is not at the top.
   *
   * Scoped to the desk, and the scoping is the same for both parties: a thread
   * with one of this doctor's patients is this desk's, and a thread with any other
   * doctor is another desk's. A message list is patient data in a different shape
   * — the bodies name people and quote their appointments — so a thread that
   * survives the filter but not the data it carries would be the worst kind of
   * leak.
   *
   * An empty thread sorts last because its `lastSentAt` is `''`, which is also
   * what the list row renders as "No messages yet". The fixtures all have
   * messages; the shape has to survive one that does not.
   */
  readonly conversations = computed<ConversationSummary[]>(() => {
    const messages = this.messageState();

    return this.conversationState()
      .filter((conversation) => this.isConversationOnDesk(conversation))
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

  /** How many of this desk's threads still owe the clinic something. */
  readonly awaitingActionCount = computed(
    () => this.conversations().filter((summary) => summary.conversation.awaitingAction).length,
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
   * changed, so the caller can tell a real transition from a no-op — including the
   * refusal to touch a thread on another desk, which changes nothing.
   */
  markConversationRead(conversationId: string): boolean {
    if (!this.conversations().some((summary) => summary.conversation.id === conversationId)) {
      return false;
    }

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
   * Returns the new message, or `null` for an empty body or a thread that is not
   * on this desk — so the composer can clear itself only when something was
   * actually sent, instead of silently eating what somebody typed.
   */
  sendMessage(conversationId: string, body: string): ConversationMessage | null {
    const text = body.trim();
    if (!text) return null;
    // Checked against `conversations` rather than the raw list, so a thread on
    // another desk is refused the same way an unknown one is.
    if (!this.conversations().some((summary) => summary.conversation.id === conversationId)) {
      return null;
    }

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

  /**
   * One of this desk's patients, or `null` for an id that is not on it.
   *
   * Tolerating a bad id rather than throwing is the same contract as
   * `conversationById`: the screen asks for a patient and renders what it got,
   * rather than an unreachable id blanking the page. The scoping is here as well
   * as in `patients` because a route param is a perfectly good way to ask for
   * somebody else's patient, and a list filter does nothing about that.
   */
  patientById(id: string): Patient | null {
    const patient = this.patientState().find((candidate) => candidate.id === id);
    return patient && this.isOnDesk(patient.doctorId) ? patient : null;
  }

  /**
   * A doctor by id, unscoped.
   *
   * A name resolver, not a list: the only ids any page can hold are the ones
   * `appointments` and `conversations` already returned, so resolving one cannot
   * widen what a page can see. `doctors` and `schedule` are the scoped reads.
   */
  doctorById(id: string): Doctor | null {
    return this.doctorState().find((doctor) => doctor.id === id) ?? null;
  }

  /**
   * A patient's appointments on this desk, soonest first.
   *
   * Empty for a patient on another desk, which is the answer rather than a
   * special case: this desk has never seen them.
   */
  appointmentsForPatient(patientId: string): Appointment[] {
    return this.appointments().filter((appointment) => appointment.patientId === patientId);
  }

  /**
   * A doctor's appointments, soonest first.
   *
   * Empty for any doctor but the assigned one, for the same reason
   * `appointmentsForPatient` is empty off-desk: the desk's view is its own.
   */
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
   * Whether a proposed appointment is allowed, and why not if it is not.
   *
   * The rule set for creating an appointment, kept here rather than in whichever
   * form asks: these are facts about the clinic's data — inside published hours,
   * no overlap with the same doctor, that doctor is on this desk and still taking
   * patients, not in the past — and a form that reimplemented them would be a
   * second answer to "is this slot free?" that could disagree with the first.
   *
   * No Secretary screen calls this any more, because a Secretary does not book.
   * It is here for whoever does create an appointment, and its tests are the
   * statement of what the clinic considers bookable.
   *
   * `ignoreId` is an appointment being placed at a time it already occupies, so
   * proposing a slot against an existing appointment is not a clash with itself.
   */
  bookingRefusal(draft: BookingDraft, ignoreId?: string): BookingRefusal | null {
    if (!draft.patientId || !this.patientById(draft.patientId)) return 'no-patient';

    const doctor = this.doctorById(draft.doctorId);
    if (!doctor) return 'no-doctor';
    if (!this.isOnDesk(draft.doctorId)) return 'not-your-doctor';
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
   * Confirms a booked appointment on this desk.
   *
   * One of the two statuses a Secretary sets, and the only move forward in the
   * lifecycle they own: `booked` to `confirmed`, meaning the patient said they are
   * coming. Everything after that — completing the visit, recording a no-show — is
   * the doctor's, so there is deliberately no status here that skips ahead of the
   * appointment actually happening.
   *
   * Refuses anything not currently `booked`: an appointment that is already
   * confirmed has nothing to confirm, and one that is completed, cancelled or a
   * no-show has ended, so reopening it would rewrite history without anyone asking.
   * Refuses another desk's appointment too — the list never offers one, but the id
   * comes from the caller and a store that trusted it would be the one place the
   * scoping could be undone.
   *
   * Returns whether anything changed, so a double click cannot re-confirm.
   */
  confirm(id: string): boolean {
    const current = this.appointmentState().find((appointment) => appointment.id === id);
    if (!current || !this.isOnDesk(current.doctorId)) return false;
    if (current.status !== 'booked') return false;

    this.appointmentState.update((appointments) =>
      appointments.map((appointment) =>
        appointment.id === id ? { ...appointment, status: 'confirmed' as const } : appointment,
      ),
    );
    return true;
  }

  /**
   * Cancels an appointment on this desk.
   *
   * The other of the two. Available from `booked` as well as `confirmed`, because a
   * patient can call off a visit before or after confirming it, and the desk has to
   * be able to say so either way. Already-cancelled and already-finished
   * appointments are ignored, so a double click cannot rewrite history, and so can
   * an id belonging to another desk.
   *
   * Cancelling is not deleting: the appointment stays in the history, which is why
   * a cancellation is reversible by whoever created the appointment rather than by
   * this desk.
   */
  cancel(id: string): boolean {
    const current = this.appointmentState().find((appointment) => appointment.id === id);
    if (!current || !this.isOnDesk(current.doctorId)) return false;
    if (CLOSED_STATUSES.includes(current.status)) return false;

    this.appointmentState.update((appointments) =>
      appointments.map((appointment) =>
        appointment.id === id ? { ...appointment, status: 'cancelled' as const } : appointment,
      ),
    );
    return true;
  }

  /**
   * Applies the fields the Profile page is allowed to change.
   *
   * Named field by field rather than spread, so a caller handing over a whole
   * profile object cannot reassign the Secretary to another doctor through it. The
   * type says `ProfileDraft` is the three editable fields, but a spread would make
   * the guarantee a compile-time suggestion rather than a rule.
   */
  updateProfile(draft: ProfileDraft): void {
    this.profileState.update((profile) => ({
      ...profile,
      name: draft.name,
      email: draft.email,
      phone: draft.phone,
    }));
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
