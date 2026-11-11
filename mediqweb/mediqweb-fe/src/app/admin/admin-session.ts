import { Injectable, computed, signal, inject } from '@angular/core';
import { forkJoin, map, from, switchMap, catchError, of, Observable } from 'rxjs';
import { HttpAdminGateway } from '../core/api/http-admin-gateway';
import { HttpPatientGateway } from '../core/api/http-patient-gateway';
import { SupabaseService } from '../core/api/supabase.service';
import { ToastService } from '../core/services/toast.service';
import type {
  AccountStatus,
  Appointment as AdminAppointment,
  AuditEntry,
  AuditSeverity,
  PatientAccount,
  Specialization as AdminSpecialization,
  StaffAccount,
  StaffDraft,
} from './admin.models';
import type {
  Appointment as ApiAppointment,
  Specialization as ApiSpecialization,
} from '../core/api/models';

/** Which staff list an operation applies to. Secretaries have no specialization. */
export type StaffKind = 'doctor' | 'secretary';

/**
 * Admin session backed by the real Ktor API.
 *
 * Fetches staff accounts, doctors, specializations and appointments from the
 * Ktor backend on construction, then keeps them in signals exactly as the old
 * mock store did. Every Admin page injects this and reads signals
 * synchronously — the first render shows empty lists while the HTTP calls are
 * in flight, then the data arrives. Mutations go to the API first and update
 * the signal optimistically.
 */
@Injectable()
export class AdminSession {
  private readonly adminGateway = inject(HttpAdminGateway);
  private readonly patientGateway = inject(HttpPatientGateway);
  private readonly supabase = inject(SupabaseService);
  private readonly toasts = inject(ToastService);

  private readonly doctorsState = signal<StaffAccount[]>([]);
  private readonly secretariesState = signal<StaffAccount[]>([]);
  private readonly patientsState = signal<PatientAccount[]>([]);
  private readonly specializationsState = signal<AdminSpecialization[]>([]);
  private readonly auditState = signal<AuditEntry[]>([]);
  private readonly appointmentsState = signal<AdminAppointment[]>([]);
  private readonly createErrorState = signal<string | null>(null);

  readonly doctors = this.doctorsState.asReadonly();
  readonly secretaries = this.secretariesState.asReadonly();
  readonly patients = this.patientsState.asReadonly();
  readonly specializations = this.specializationsState.asReadonly();
  readonly auditEntries = this.auditState.asReadonly();
  readonly appointments = this.appointmentsState.asReadonly();
  readonly createError = this.createErrorState.asReadonly();

  /** Clear any server-reported create-account error (e.g. when reopening the form). */
  clearCreateError(): void {
    this.createErrorState.set(null);
  }

  constructor() {
    forkJoin({
      accounts: this.adminGateway.getAccounts(),
      doctorSpecs: this.adminGateway.getDoctorSpecializations(),
    }).subscribe({
      next: ({ accounts, doctorSpecs }) => {
        const doctors = accounts.doctors as unknown as StaffAccount[];
        const secretaries = accounts.secretaries as unknown as StaffAccount[];
        const patients = accounts.patients as unknown as PatientAccount[];
        // doctorSpecs maps doctor.user_id -> { specializationId, licenseNumber };
        // accounts are already mapped StaffAccount objects from getAccounts(),
        // so spread and overlay specialization/license rather than remap.
        this.doctorsState.set(
          doctors.map((d) => {
            const meta = doctorSpecs.get(d.id);
            return { ...d, specializationId: meta?.specializationId ?? null, licenseNumber: meta?.licenseNumber ?? null };
          }),
        );
        this.secretariesState.set(secretaries);
        this.patientsState.set(patients);
      },
      error: () => {
        // Leave lists empty; pages show nothing until data arrives.
      },
    });

    this.patientGateway.getSpecializations().subscribe({
      next: (specs: ApiSpecialization[]) =>
        this.specializationsState.set(specs as unknown as AdminSpecialization[]),
      error: () => {},
    });

    this.adminGateway.getAppointments().subscribe({
      next: (paged) =>
        this.appointmentsState.set((paged.items ?? []) as unknown as AdminAppointment[]),
      error: () => {},
    });

    this.adminGateway.getAuditLogs().subscribe({
      next: (logs) => this.auditState.set(logs),
      error: () => {},
    });
  }

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

  /** Active doctors only, for the create-account form's assigned-doctor field. */
  activeDoctorOptions(): { id: string; label: string }[] {
    return this.doctorsState()
      .filter((d) => d.status === 'active')
      .map((d) => ({ id: d.id, label: d.name }));
  }

  // ---------------------------------------------------------------------------
  // Mutations — real API calls, optimistic signal updates
  // ---------------------------------------------------------------------------
  addStaffAccount(kind: StaffKind, draft: StaffDraft): StaffAccount {
    // Optimistic: the account id is assigned by the server, so we can't know it
    // yet. The server returns the created account; we add it when it arrives.
    const optimistic: StaffAccount = {
      id: '',
      name: draft.name.trim(),
      email: draft.email.trim(),
      username: draft.username.trim(),
      status: draft.status,
      role: kind,
      specializationId: kind === 'doctor' ? (draft.specializationId ?? null) : null,
      licenseNumber: kind === 'doctor' ? draft.licenseNumber?.trim() || null : null,
      assignedDoctorId: kind === 'secretary' ? draft.assignedDoctorId?.trim() || null : null,
      joinedOn: new Date().toISOString().slice(0, 10),
      lastActiveOn: null,
    };
    const target = kind === 'doctor' ? this.doctorsState : this.secretariesState;
    target.update((list) => [optimistic, ...list]);

    this.adminGateway.createStaffAccount(kind, draft).subscribe({
      next: (created: StaffAccount) => {
        target.update((list) => list.map((a) => (a.id === '' ? created : a)));
        this.record(`Created ${kind} account`, created.name, 'info');
        this.createErrorState.set(null);
        // Refresh full lists so newly created account appears alongside existing ones
        this.adminGateway.getAccounts().subscribe({
          next: ({ doctors: d, secretaries: s, patients: p }) => {
            this.doctorsState.set(d as StaffAccount[]);
            this.secretariesState.set(s as StaffAccount[]);
            this.patientsState.set(p as unknown as PatientAccount[]);
          },
          error: () => {},
        });
      },
      error: (err: unknown) => {
        console.error('createStaffAccount failed:', err);
        const serverMessage = (err as { error?: { message?: string } })?.error?.message;
        this.createErrorState.set(serverMessage ?? 'Failed to create account.');
        target.update((list) => list.filter((a) => a.id === ''));
      },
    });

    return optimistic;
  }

  setStaffStatus(kind: StaffKind, id: string, status: AccountStatus): boolean {
    const target = kind === 'doctor' ? this.doctorsState : this.secretariesState;
    const existing = target().find((a) => a.id === id);
    if (!existing || existing.status === status) return false;

    target.update((list) => list.map((a) => (a.id === id ? { ...a, status } : a)));
    this.adminGateway.updateAccountStatus(id, status).subscribe({
      next: () => {
        this.record(
          status === 'active' ? 'Reactivated account' : 'Deactivated account',
          existing.name,
          status === 'active' ? 'info' : 'warning',
        );
      },
      error: () => {
        target.update((list) =>
          list.map((a) => (a.id === id ? { ...a, status: existing.status } : a)),
        );
      },
    });
    return true;
  }

  setAssignedDoctor(kind: StaffKind, id: string, doctorId: string): boolean {
    const target = kind === 'doctor' ? this.doctorsState : this.secretariesState;
    const existing = target().find((a) => a.id === id);
    if (!existing || existing.assignedDoctorId === doctorId) return false;

    target.update((list) =>
      list.map((a) => (a.id === id ? { ...a, assignedDoctorId: doctorId } : a)),
    );
    this.adminGateway.updateAssignedDoctor(id, doctorId).subscribe({
      next: () => {
        const doctor = this.doctorsState().find((d) => d.id === doctorId)?.name ?? doctorId;
        this.record(`Reassigned secretary to ${doctor}`, existing.name, 'info');
      },
      error: () => {
        target.update((list) =>
          list.map((a) =>
            a.id === id ? { ...a, assignedDoctorId: existing.assignedDoctorId } : a,
          ),
        );
      },
    });
    return true;
  }

  setPatientStatus(id: string, status: AccountStatus): boolean {
    const existing = this.patientsState().find((p) => p.id === id);
    if (!existing || existing.status === status) return false;

    this.patientsState.update((list) => list.map((p) => (p.id === id ? { ...p, status } : p)));
    // Ktor has no patient status endpoint; update optimistically only.
    this.record(
      status === 'active' ? 'Reactivated patient' : 'Deactivated patient',
      existing.name,
      status === 'active' ? 'info' : 'warning',
    );
    return true;
  }

  addSpecialization(name: string, description: string): Observable<AdminSpecialization> {
    const id = crypto.randomUUID();
    const specialization: AdminSpecialization = {
      id,
      name: name.trim(),
      description: description.trim(),
    };
    this.specializationsState.update((list) => [...list, specialization]);

    // Persist to Supabase so the server assigns a real id.
    return from(
      (this.supabase as any)
        .from('specializations')
        .insert({ id, name: specialization.name, description: specialization.description })
        .select()
        .single(),
    ).pipe(
      switchMap((r: any) => {
        if (r.error) {
          throw new Error(r.error?.message ?? 'Failed to create specialization');
        }
        const created = r.data;
        // Replace the optimistic entry with the server-created one.
        this.specializationsState.update((list) =>
          list.map((s) => (s.id === id ? { ...created } as AdminSpecialization : s)),
        );
        return of(created as AdminSpecialization);
      }),
      catchError((err: any) => {
        this.specializationsState.update((list) => list.filter((s) => s.id === id));
        this.toasts.error('Failed to create specialization', err.message ?? 'Unknown error');
        return of(specialization);
      }),
    );
  }

  updateSpecialization(id: string, name: string, description: string): void {
    const existing = this.specializationsState().find((s) => s.id === id);
    if (!existing) return;

    this.specializationsState.update((list) =>
      list.map((s) =>
        s.id === id ? { ...s, name: name.trim(), description: description.trim() } : s,
      ),
    );
    // Ktor PUT /specializations/{id} not yet exposed via gateway; update optimistically.
    this.record('Updated specialization', name.trim(), 'info');
  }

  private record(action: string, target: string, severity: AuditSeverity): void {
    const entry: AuditEntry = {
      id: '',
      actor: 'current-user',
      action,
      target,
      at: new Date().toISOString(),
      severity,
    };
    this.auditState.update((list) => [entry, ...list]);

    // Persist to Supabase audit_logs table.
    const now = new Date().toISOString();
    from(
      this.supabase
        .from('audit_logs')
        .insert({
          id: crypto.randomUUID(),
          actor: entry.actor,
          action: entry.action,
          target: entry.target,
          at: now,
          severity,
          created_at: now,
        }),
    ).subscribe({
      error: () => {
        // Don't surface audit persistence failures to the user — local state is updated.
      },
    });
  }

  private newestFirst(entries: readonly AuditEntry[]): AuditEntry[] {
    return [...entries].sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  }
}

interface ApiAccount {
  readonly id: string;
  readonly username: string;
  readonly fullName: string;
  readonly email: string;
  readonly mobileNumber: string;
  readonly dateOfBirth: string;
  readonly status: AccountStatus;
  readonly role?: string;
  /** Doctors only — Ktor returns it shaped on the account. */
  readonly licenseNumber?: string | null;
  readonly doctorId?: string | null;
  readonly assignedDoctorId?: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Ktor returns fullName / mobileNumber / createdAt; PatientAccount wants name / phone / registeredOn. */
function toPatientAccount(api: ApiAccount): PatientAccount {
  return {
    id: api.id,
    name: api.fullName,
    email: api.email,
    phone: api.mobileNumber,
    dateOfBirth: api.dateOfBirth,
    status: api.status,
    registeredOn: api.createdAt ? api.createdAt.slice(0, 10) : '',
  };
}

/** Ktor staff accounts carry role + specialization + licenseNumber already shaped correctly. */
function toStaffAccount(
  api: ApiAccount,
  specializationId: string | null = null,
  licenseNumber: string | null = null,
): StaffAccount {
  return {
    id: api.id,
    name: api.fullName,
    email: api.email,
    username: api.username,
    status: api.status,
    role: api.role,
    specializationId,
    licenseNumber,
    assignedDoctorId: api.role === 'secretary' ? (api.assignedDoctorId ?? null) : null,
    joinedOn: api.createdAt,
    lastActiveOn: null,
  };
}
