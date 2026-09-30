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

/** Fields the Profile page is allowed to change. */
export type ProfileDraft = Pick<SecretaryProfile, 'name' | 'email' | 'phone'>;
