import { Injectable, computed, signal } from '@angular/core';
import {
  MOCK_APPOINTMENTS,
  MOCK_AUDIT_ENTRIES,
  MOCK_DOCTORS,
  MOCK_PATIENTS,
  MOCK_SECRETARIES,
  MOCK_SPECIALIZATIONS,
} from './admin.mock-data';
import type {
  AccountStatus,
  Appointment,
  AuditEntry,
  AuditSeverity,
  PatientAccount,
  Specialization,
  StaffAccount,
  StaffDraft,
} from './admin.models';

/** Which staff list an operation applies to. Secretaries have no specialization. */
export type StaffKind = 'doctor' | 'secretary';

/**
 * Id counter, seeded past the highest id already in the sample data.
 *
 * Starting at zero would hand out `doc-001` and `log-001`, which the fixtures
 * already use. Duplicate ids are not just untidy here: the tables track rows by
 * id, so a collision makes Angular throw NG0955 and renders the wrong row.
 *
 * The counter is a single sequence across all prefixes, so ids stay unique even
 * though a new doctor and a new log entry can otherwise land on the same number.
 */
let sequence = Math.max(
  ...[
    ...MOCK_DOCTORS,
    ...MOCK_SECRETARIES,
    ...MOCK_PATIENTS,
    ...MOCK_SPECIALIZATIONS,
    ...MOCK_AUDIT_ENTRIES,
  ]
    .map((record) => Number.parseInt(record.id.replace(/^[a-z]+-/, ''), 10))
    .filter((n) => Number.isFinite(n)),
);

/** Deterministic ids keep the mock predictable in tests. */
const nextId = (prefix: string) => `${prefix}-${String(++sequence).padStart(3, '0')}`;

/**
 * In-memory stand-in for the Admin API.
 *
 * Every screen in the Admin area reads from here, so the whole area can be
 * exercised end to end without a backend. Replacing this with a service that
 * talks to the API is the only change the screens should ever need.
 *
 * This store is **not** persistence. A reload discards everything, no password
 * is generated or hashed, and account creation here is a UI demonstration
 * rather than real account creation.
 */
@Injectable()
export class AdminSession {
  private readonly doctorsState = signal<StaffAccount[]>([...MOCK_DOCTORS]);
  private readonly secretariesState = signal<StaffAccount[]>([...MOCK_SECRETARIES]);
  private readonly patientsState = signal<PatientAccount[]>([...MOCK_PATIENTS]);
  private readonly specializationsState = signal<Specialization[]>([...MOCK_SPECIALIZATIONS]);
  private readonly auditState = signal<AuditEntry[]>([...MOCK_AUDIT_ENTRIES]);
  private readonly appointmentsState = signal<Appointment[]>([...MOCK_APPOINTMENTS]);

  readonly doctors = this.doctorsState.asReadonly();
  readonly secretaries = this.secretariesState.asReadonly();
  readonly patients = this.patientsState.asReadonly();
  readonly specializations = this.specializationsState.asReadonly();
  readonly auditEntries = this.auditState.asReadonly();
  /**
   * Every appointment in the clinic.
   *
   * A signal, unlike the fixtures it starts from, because this is the store's
   * usual shape rather than because anything writes it yet: the Admin reads the
   * clinic's appointments but does not book, confirm or cancel them, so the
   * day one of those becomes an Admin action this does not have to change
   * shape. The dashboard charts it; nothing else consumes it.
   */
  readonly appointments = this.appointmentsState.asReadonly();

  // ---------------------------------------------------------------------------
  // Counts for the dashboard
  // ---------------------------------------------------------------------------
  readonly activeDoctorCount = computed(
    () => this.doctorsState().filter((d) => d.status === 'active').length,
  );
  readonly activeSecretaryCount = computed(
    () => this.secretariesState().filter((s) => s.status === 'active').length,
  );
  readonly activePatientCount = computed(
    () => this.patientsState().filter((p) => p.status === 'active').length,
  );
  /** Newest first, for the dashboard's activity list. */
  readonly recentActivity = computed(() => this.newestFirst(this.auditState()).slice(0, 6));

  // ---------------------------------------------------------------------------
  // Lookups
  // ---------------------------------------------------------------------------
  staffOf(kind: StaffKind): readonly StaffAccount[] {
    return kind === 'doctor' ? this.doctorsState() : this.secretariesState();
  }

  specializationName(id: string | null): string {
    if (!id) return '—';
    return this.specializationsState().find((s) => s.id === id)?.name ?? 'Unknown';
  }

  /** Options for the create-account form's specialization field. */
  specializationOptions(): { id: string; label: string }[] {
    return this.specializationsState().map((s) => ({ id: s.id, label: s.name }));
  }

  /**
   * Options for the create-account form's assigned-doctor field.
   *
   * Active doctors only, and the reason is the Secretary's side rather than the
   * Admin's: an inactive doctor cannot take bookings and publishes no schedule,
   * so a secretary assigned to one would sign in to an empty area with no way to
   * tell that from their own fault. Enabling the doctor later is what makes the
   * assignment usable, so the desk can wait for its doctor rather than the other
   * way round.
   *
   * Offered with the specialization, so a reader can see both role fields are
   * built the same way rather than wondering why one is filtered.
   */
  activeDoctorOptions(): { id: string; label: string }[] {
    return this.doctorsState()
      .filter((d) => d.status === 'active')
      .map((d) => ({ id: d.id, label: d.name }));
  }

  // ---------------------------------------------------------------------------
  // Mutations — mock only
  // ---------------------------------------------------------------------------
  addStaffAccount(kind: StaffKind, draft: StaffDraft): StaffAccount {
    const account: StaffAccount = {
      id: nextId(kind === 'doctor' ? 'doc' : 'sec'),
      name: draft.name.trim(),
      email: draft.email.trim(),
      username: draft.username.trim(),
      status: draft.status,
      specializationId: kind === 'doctor' ? (draft.specializationId ?? null) : null,
      licenseNumber: kind === 'doctor' ? draft.licenseNumber?.trim() || null : null,
      // A doctor's desk belongs to them, so the field is meaningless on one and
      // is dropped here rather than trusted from a draft the form built for the
      // other role. Trimmed to null like the licence above: a whitespace-only
      // assignment would otherwise persist as an id that resolves to no doctor.
      assignedDoctorId: kind === 'secretary' ? draft.assignedDoctorId?.trim() || null : null,
      joinedOn: today(),
      lastActiveOn: null,
    };

    const target = kind === 'doctor' ? this.doctorsState : this.secretariesState;
    target.update((list) => [account, ...list]);
    this.record(`Created ${kind} account`, account.name, 'info');
    return account;
  }

  /**
   * Flips an account between usable and not, recording the change. Disabling
   * rather than deleting keeps the record of the account intact.
   */
  setStaffStatus(kind: StaffKind, id: string, status: AccountStatus): void {
    const target = kind === 'doctor' ? this.doctorsState : this.secretariesState;
    const existing = target().find((a) => a.id === id);
    if (!existing || existing.status === status) return;

    target.update((list) => list.map((a) => (a.id === id ? { ...a, status } : a)));
    this.record(
      status === 'active' ? 'Reactivated account' : 'Deactivated account',
      existing.name,
      status === 'active' ? 'info' : 'warning',
    );
  }

  setPatientStatus(id: string, status: AccountStatus): void {
    const existing = this.patientsState().find((p) => p.id === id);
    if (!existing || existing.status === status) return;

    this.patientsState.update((list) => list.map((p) => (p.id === id ? { ...p, status } : p)));
    this.record(
      status === 'active' ? 'Reactivated patient' : 'Deactivated patient',
      existing.name,
      status === 'active' ? 'info' : 'warning',
    );
  }

  addSpecialization(name: string, description: string): Specialization {
    const specialization: Specialization = {
      id: nextId('spec'),
      name: name.trim(),
      description: description.trim(),
    };
    this.specializationsState.update((list) => [...list, specialization]);
    this.record('Added specialization', specialization.name, 'info');
    return specialization;
  }

  /**
   * Renames a specialization in place. A mock with no storage has no way to
   * detect that a name is already taken, so the check will move to the API.
   */
  updateSpecialization(id: string, name: string, description: string): void {
    const existing = this.specializationsState().find((s) => s.id === id);
    if (!existing) return;

    this.specializationsState.update((list) =>
      list.map((s) =>
        s.id === id ? { ...s, name: name.trim(), description: description.trim() } : s,
      ),
    );
    this.record('Updated specialization', name.trim(), 'info');
  }

  private record(action: string, target: string, severity: AuditSeverity): void {
    const entry: AuditEntry = {
      id: nextId('log'),
      actor: 'Alex Rivera',
      action,
      target,
      at: new Date().toISOString(),
      severity,
    };
    this.auditState.update((list) => [entry, ...list]);
  }

  private newestFirst(entries: readonly AuditEntry[]): AuditEntry[] {
    return [...entries].sort((a, b) => b.at.localeCompare(a.at));
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
