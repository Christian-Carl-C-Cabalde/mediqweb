import type { AccountStatus } from '../shared/domain/account-status';

/**
 * Doctor area domain shapes.
 *
 * These describe what the Doctor screens display. They carry no persistence or
 * business rules — every screen is static until a real service replaces
 * `DoctorSession`.
 *
 * Deliberately absent: diagnoses, clinical notes, prescriptions and vitals.
 * Patient records are a separate milestone with their own access rules, and
 * inventing clinical content here would look like it had been reviewed.
 */

/**
 * Where an appointment is in its lifecycle.
 *
 * A doctor moves an appointment forward; a Secretary creates it. There is no
 * `booked` -> `cancelled` rule enforced here beyond what the buttons offer,
 * because the API's rules are not written yet.
 *
 * Re-exported from `shared/domain` rather than declared here, because the
 * Secretary area works with the same lifecycle and the shared
 * `ui-appointment-status` renders both. Existing imports keep working.
 */
export type { AppointmentStatus } from '../shared/domain/appointment-status';

import type { AppointmentStatus } from '../shared/domain/appointment-status';

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

/**
 * A patient as the Doctor area sees them: enough to identify and contact the
 * person, and nothing about their health.
 */
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
  /** Most recent past appointment with the signed-in doctor, cancelled included. */
  readonly lastVisit: Appointment | null;
  /** Next appointment that has not been cancelled, ignoring `no-show`. */
  readonly nextVisit: Appointment | null;
  /** Appointments that reached a consultation, i.e. `completed` or `no-show`. */
  readonly visitCount: number;
}

export interface DoctorProfile {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  readonly specialization: string;
  /** Issued by the regulator, not editable here — the Admin owns it. */
  readonly licenseNumber: string;
  /** ISO date. */
  readonly joinedOn: string;
  /** Short introduction shown to patients when they book. */
  readonly bio: string;
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

/** Fields the Profile page is allowed to change. */
export type ProfileDraft = Pick<DoctorProfile, 'name' | 'email' | 'phone' | 'bio'>;
