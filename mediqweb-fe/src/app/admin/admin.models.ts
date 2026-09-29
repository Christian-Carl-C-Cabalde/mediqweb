/**
 * Admin area domain shapes.
 *
 * These describe what the Admin screens display. They deliberately carry no
 * persistence or business rules — every screen is static until a real service
 * replaces the mock session store.
 */

/**
 * An account is either usable or not.
 *
 * Declared in `shared/domain` rather than here because staff and patient
 * accounts carry the same status in every role area, and Admin has no business
 * being the one place that says what an inactive account means. Re-exported so
 * the existing `admin.models` import sites keep working unchanged.
 */
export type { AccountStatus } from '../shared/domain/account-status';

import type { AccountStatus } from '../shared/domain/account-status';

export interface StaffAccount {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly status: AccountStatus;
  /** Doctors only. */
  readonly specializationId: string | null;
  /** Doctors only. */
  readonly licenseNumber: string | null;
  /** ISO date, e.g. `2026-04-18`. */
  readonly joinedOn: string;
  /** ISO date, or null when the account has never signed in. */
  readonly lastActiveOn: string | null;
}

export interface PatientAccount {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly phone: string;
  /** ISO date, e.g. `1991-02-11`. */
  readonly dateOfBirth: string;
  readonly status: AccountStatus;
  /** ISO date. */
  readonly registeredOn: string;
}

export interface Specialization {
  readonly id: string;
  readonly name: string;
  readonly description: string;
}

/** How much attention an audit entry deserves. Drives the row's badge tone. */
export type AuditSeverity = 'info' | 'warning' | 'danger';

export interface AuditEntry {
  readonly id: string;
  /** Who performed the action. */
  readonly actor: string;
  /** What they did, in the past tense, e.g. "Deactivated account". */
  readonly action: string;
  /** What they did it to, e.g. "Dr. Elena Vargas". */
  readonly target: string;
  /** ISO date and time. */
  readonly at: string;
  readonly severity: AuditSeverity;
}

/** Role-specific extras collected by the create-account form. */
export interface StaffDraft {
  readonly firstName: string;
  readonly lastName: string;
  readonly email: string;
  /** Doctors only. */
  readonly specializationId?: string | null;
  /** Doctors only. */
  readonly licenseNumber?: string | null;
}
