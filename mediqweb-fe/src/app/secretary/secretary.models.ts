import type { AccountStatus } from '../shared/domain/account-status';

/**
 * Secretary area domain shapes.
 *
 * These describe what the Secretary screens display. They carry no persistence or
 * business rules — every screen is static until a real service replaces
 * `SecretarySession`.
 *
 * The Secretary manages appointments for all doctors and sees all patients.
 * Unlike the Doctor area, there is no scoping to a single provider.
 */

/**
 * Where an appointment is in its lifecycle.
 *
 * A Secretary creates and manages appointments; doctors move them forward.
 * The Secretary can book, reschedule, and cancel — but not confirm/complete/no-show,
 * which are clinical decisions the doctor owns.
 *
 * Re-exported from `shared/domain` rather than declared here, because the Doctor
 * area works with the same lifecycle and the shared `ui-appointment-status`
 * renders both. Existing imports keep working.
 */
export type { AppointmentStatus } from '../shared/domain/appointment-status';

import type { AppointmentStatus } from '../shared/domain/appointment-status';

/**
 * Statuses a Secretary is allowed to move an appointment into.
 *
 * The Secretary books (creates as 'booked') and can cancel.
 * Rescheduling keeps the status; moving to confirmed/completed/no-show
 * is the doctor's action.
 */
export type SecretaryAppointmentAction = 'book' | 'reschedule' | 'cancel';

export interface Appointment {
  readonly id: string;
  readonly patientId: string;
  readonly doctorId: string;
  /**
   * Local timestamp without a zone, e.g. `2026-04-18T09:00:00`.
   *
   * Deliberately not a UTC instant: a clinic's 09:00 is the clinic's 09:00, and
   * `Date` parses a zone-less string in local time, so `new Date(...)` and the
   * `date` pipe agree without a timezone conversion.
   */
  readonly startsAt: string;
  readonly durationMinutes: number;
  readonly status: AppointmentStatus;
  /** Why the patient is coming in. Administrative, not clinical. */
  readonly reason: string;
}

export interface Patient {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  /** ISO date, e.g. `1986-03-14`. */
  readonly dateOfBirth: string;
  readonly address: string;
  /** ISO date. */
  readonly registeredOn: string;
  readonly status: AccountStatus;
}

/** A patient plus the visit figures the list and dashboard need. */
export interface PatientSummary {
  readonly patient: Patient;
  readonly lastVisit: Appointment | null;
  readonly nextVisit: Appointment | null;
  readonly visitCount: number;
}

export interface Doctor {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly specialization: string;
  /** Issued by the regulator, not editable here — the Admin owns it. */
  readonly licenseNumber: string;
  /** ISO date. */
  readonly joinedOn: string;
  readonly status: AccountStatus;
}

/** A doctor plus availability summary for the list view. */
export interface DoctorSummary {
  readonly doctor: Doctor;
  readonly weeklyHours: string;
  readonly nextAvailable: string | null;
}

/** One day of the repeating weekly availability a doctor publishes. */
export interface ScheduleDay {
  /** 0 = Sunday … 6 = Saturday, matching `Date.prototype.getDay()`. */
  readonly dayOfWeek: number;
  readonly enabled: boolean;
  /** `HH:MM` on a 24-hour clock, e.g. `09:00`. */
  readonly startTime: string;
  readonly endTime: string;
}

export interface SecretaryProfile {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  /** ISO date. */
  readonly joinedOn: string;
}

// ---------------------------------------------------------------------------
// Messaging
// ---------------------------------------------------------------------------

/**
 * Who a conversation is with.
 *
 * A Secretary's messages are with patients and with doctors, and the two want
 * different subtitles and different follow-up, so the party is tagged rather
 * than resolved by looking an id up in two lists where one id could match both.
 */
export type MessageParty = 'patient' | 'doctor';

/** One message in a thread. */
export interface ConversationMessage {
  readonly id: string;
  readonly conversationId: string;
  /** Zone-less local timestamp, as `Appointment.startsAt`. */
  readonly sentAt: string;
  readonly body: string;
  /**
   * Whether the signed-in Secretary wrote it.
   *
   * Part of the message rather than a comparison against the session's id, so a
   * thread still reads correctly when it is handed to somebody else — a real API
   * would send an author role per message and the screen would not change.
   */
  readonly fromSecretary: boolean;
  /**
   * When the thread was opened, or `null` while the message is still unread.
   *
   * A timestamp rather than a boolean so a real API can return a server-side
   * read receipt without this shape changing, and so "unread since" is available
   * for free if the list ever needs to say it.
   */
  readonly readAt: string | null;
}

/** A thread with one patient or one doctor. */
export interface Conversation {
  readonly id: string;
  readonly party: MessageParty;
  /** The `Patient.id` or `Doctor.id` this thread is with. */
  readonly partyId: string;
  /**
   * Whether the desk still owes something on this thread.
   *
   * Deliberately independent of the unread count: a thread can be read to the
   * last word and still need the Secretary to go and do the thing that was
   * asked for. Deriving one from the other would quietly lose that case.
   */
  readonly awaitingAction: boolean;
}

/** A conversation plus what the list row and the thread header need. */
export interface ConversationSummary {
  readonly conversation: Conversation;
  /** Resolved from `partyId`, so a person's name exists in exactly one fixture. */
  readonly name: string;
  readonly messages: readonly ConversationMessage[];
  readonly unreadCount: number;
  /** `sentAt` of the newest message. Also the list's sort key. */
  readonly lastSentAt: string;
  /** The newest message's text, trimmed onto one line for the list row. */
  readonly preview: string;
  /** The newest message's writer, so the row can say who spoke last. */
  readonly lastFromSecretary: boolean;
}

/** Fields the Profile page is allowed to change. */
export type ProfileDraft = Pick<SecretaryProfile, 'name' | 'email' | 'phone'>;
