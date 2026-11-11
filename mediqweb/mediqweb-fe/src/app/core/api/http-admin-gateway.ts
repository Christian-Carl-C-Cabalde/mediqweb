import { Injectable, inject } from '@angular/core';
import { from, map, Observable, switchMap } from 'rxjs';
import type { StaffAccount, StaffDraft, AuditEntry, AuditSeverity } from '../../admin/admin.models';
import type { PatientAccount } from '../../admin/admin.models';
import type { AccountStatus } from '../../shared/domain/account-status';
import { SupabaseService } from './supabase.service';
import type { Appointment, AppointmentFilter, Paged } from './models';

function toStaffAccount(
  row: any,
  specializationId: string | null = null,
  licenseNumber: string | null = null,
): StaffAccount {
  return {
    id: row.user_id,
    name: row.full_name ?? '',
    email: row.email ?? '',
    username: row.username,
    status: row.status,
    role: row.role,
    specializationId,
    licenseNumber,
    assignedDoctorId: row.assigned_doctor_id ?? null,
    joinedOn: row.created_at ?? '',
    lastActiveOn: null,
  };
}

function toPatientAccount(row: any): PatientAccount {
  return {
    id: row.user_id,
    name: row.full_name ?? '',
    email: row.email ?? '',
    phone: row.email ?? '',
    dateOfBirth: '',
    status: row.status,
    registeredOn: row.created_at ?? '',
  };
}

function toAuditEntry(row: any): AuditEntry {
  return {
    id: row.id,
    actor: row.actor_id ?? '',
    action: row.action,
    target: row.target,
    at: row.created_at,
    severity: 'info' as AuditSeverity,
  };
}

function toAppointment(row: any): Appointment {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    startsAt: row.starts_at,
    durationMinutes: row.duration_minutes,
    status: row.status,
    reason: row.reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

@Injectable({ providedIn: 'root' })
export class HttpAdminGateway {
  private supabase = inject(SupabaseService);

  getAccounts(): Observable<{
    patients: StaffAccount[];
    doctors: StaffAccount[];
    secretaries: StaffAccount[];
  }> {
    return from(this.supabase.getUser()).pipe(
      switchMap((result: any) => {
        if (result.error || !result.data?.user) {
          throw new Error('Not authenticated');
        }
        return from(
          (this.supabase as any)
            .from('profiles')
            .select('*')
            .eq('role', 'ADMIN')
            .eq('user_id', result.data.user.id)
            .maybeSingle(),
        ).pipe(
          switchMap((adminResult: any) => {
            if (adminResult.error) {
              throw new Error(adminResult.error?.message ?? 'Failed to verify admin');
            }
            if (!adminResult.data) {
              throw new Error('Admin only');
            }
            return from((this.supabase as any).from('profiles').select('*')).pipe(
              map((r: any) => {
                if (r.error) {
                  throw new Error(r.error?.message ?? 'Failed to load accounts');
                }
                const rows = r.data ?? [];
                return {
                  patients: rows.filter((x: any) => x.role === 'PATIENT').map(toStaffAccount),
                  doctors: rows.filter((x: any) => x.role === 'DOCTOR').map(toStaffAccount),
                  secretaries: rows.filter((x: any) => x.role === 'SECRETARY').map(toStaffAccount),
                };
              }),
            );
          }),
        );
      }),
    );
  }

  createStaffAccount(kind: 'doctor' | 'secretary', draft: StaffDraft): Observable<StaffAccount> {
    return from(this.supabase.getUser()).pipe(
      switchMap((result: any) => {
        if (result.error || !result.data?.user) {
          throw new Error('Not authenticated');
        }
        // Verify caller is ADMIN by reading their profile
        return from(
          (this.supabase as any)
            .from('profiles')
            .select('role')
            .eq('user_id', result.data.user.id)
            .maybeSingle(),
        ).pipe(
          switchMap((adminResult: any) => {
            if (adminResult.error) {
              throw new Error(adminResult.error?.message ?? 'Failed to verify admin');
            }
            if (!adminResult.data || adminResult.data.role !== 'ADMIN') {
              throw new Error('Admin only');
            }
            // Call Edge Function that creates auth user + domain rows via service role
            return from(
              (this.supabase as any).client.functions.invoke('create-staff-account', {
                body: {
                  email: draft.email,
                  username: draft.username,
                  fullName: draft.name,
                  password: draft.password,
                  role: kind,
                  specializationId: draft.specializationId ?? null,
                  licenseNumber: draft.licenseNumber ?? null,
                  assignedDoctorId: draft.assignedDoctorId ?? null,
                  mobileNumber: '',
                  dateOfBirth: '',
                },
              }),
            ).pipe(
              map((fnResult: any) => {
                if (fnResult.error) {
                  throw new Error(fnResult.error.message ?? 'Failed to create account');
                }
                const { userId, role: createdRole } = fnResult;
                return {
                  id: userId,
                  name: draft.name,
                  email: draft.email,
                  username: draft.username,
                  status: draft.status,
                  role: kind,
                  specializationId: kind === 'doctor' ? draft.specializationId ?? null : null,
                  licenseNumber: kind === 'doctor' ? draft.licenseNumber ?? null : null,
                  assignedDoctorId: kind === 'secretary' ? draft.assignedDoctorId ?? null : null,
                  joinedOn: new Date().toISOString().slice(0, 10),
                  lastActiveOn: null,
                } as StaffAccount;
              }),
            );
          }),
        );
      }),
    );
  }

  updateAccountStatus(id: string, status: AccountStatus): Observable<StaffAccount> {
    return from(
      (this.supabase as any)
        .from('profiles')
        .update({ status })
        .eq('user_id', id)
        .select()
        .maybeSingle(),
    ).pipe(
      map((r: any) => {
        if (r.error || !r.data) {
          throw new Error(r.error?.message ?? 'Failed to update status');
        }
        return toStaffAccount(r.data);
      }),
    );
  }

  updateAssignedDoctor(id: string, doctorId: string): Observable<StaffAccount> {
    return from(
      (this.supabase as any)
        .from('profiles')
        .update({ assigned_doctor_id: doctorId })
        .eq('user_id', id)
        .select()
        .maybeSingle(),
    ).pipe(
      map((r: any) => {
        if (r.error || !r.data) {
          throw new Error(r.error?.message ?? 'Failed to assign doctor');
        }
        return toStaffAccount(r.data);
      }),
    );
  }

  getDoctorsForAdmin(): Observable<StaffAccount[]> {
    return from((this.supabase as any).from('profiles').select('*').eq('role', 'DOCTOR')).pipe(
      map((r: any) => {
        if (r.error) {
          throw new Error(r.error?.message ?? 'Failed to load doctors');
        }
        return (r.data ?? []).map(toStaffAccount);
      }),
    );
  }

  getDoctorSpecializations(): Observable<
    Map<string, { specializationId: string | null; licenseNumber: string | null }>
  > {
    return from(
      (this.supabase as any).from('doctors').select('user_id, specialization_id, license_number'),
    ).pipe(
      map((r: any) => {
        if (r.error) {
          throw new Error(r.error?.message ?? 'Failed to load doctor specializations');
        }
        return new Map(
          (r.data ?? []).map((d: any) => [
            d.user_id,
            { specializationId: d.specialization_id, licenseNumber: d.license_number },
          ]),
        );
      }),
    );
  }

  getAuditLogs(): Observable<AuditEntry[]> {
    return from(
      (this.supabase as any)
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false }),
    ).pipe(
      map((r: any) => {
        if (r.error) {
          throw new Error(r.error?.message ?? 'Failed to load audit logs');
        }
        return (r.data ?? []).map(toAuditEntry);
      }),
    );
  }

  getAppointments(filter?: AppointmentFilter): Observable<Paged<Appointment>> {
    let q = (this.supabase as any).from('appointments').select('*', { count: 'exact' });
    if (filter?.doctorId) {
      q = q.eq('doctor_id', filter.doctorId);
    }
    if (filter?.status) {
      q = q.eq('status', filter.status);
    }
    if (filter?.limit) {
      q = q.limit(filter.limit);
    }
    if (filter?.offset) {
      q = q.range(filter.offset, filter.offset + (filter.limit ?? 20) - 1);
    } else if (filter?.limit) {
      q = q.range(0, filter.limit - 1);
    }
    return from(q).pipe(
      map((r: any) => ({
        items: (r.data ?? []).map(toAppointment),
        total: r.count ?? (r.data ?? []).length,
        limit: filter?.limit ?? (r.data ?? []).length,
        offset: filter?.offset ?? 0,
      })),
    );
  }

  getSettings(): Observable<{
    clinic_name: string;
    address: string;
    contact_email: string;
    contact_number: string;
    session_timeout_minutes: number;
    retention_period_days: number;
    updated_at: string;
  }> {
    return from((this.supabase as any).from('clinic_settings').select('*').single()).pipe(
      map((r: any) => {
        if (r.error) {
          throw new Error(r.error?.message ?? 'Failed to load settings');
        }
        return r.data ?? {};
      }),
    );
  }

  updateSettings(draft: {
    clinic_name?: string;
    address?: string;
    contact_email?: string;
    contact_number?: string;
    session_timeout_minutes?: number;
    retention_period_days?: number;
  }): Observable<{ id: string }> {
    return from(this.supabase.getUser()).pipe(
      switchMap((result: any) => {
        if (result.error || !result.data?.user) {
          throw new Error('Not authenticated');
        }
        return from(
          (this.supabase as any)
            .from('clinic_settings')
            .update({ ...draft, updated_by: result.data.user.id })
            .eq('id', 'clinic')
            .select('id')
            .single(),
        ).pipe(
          map((r: any) => {
            if (r.error) {
              throw new Error(r.error?.message ?? 'Failed to save settings');
            }
            return r.data ?? { id: 'clinic' };
          }),
        );
      }),
    );
  }
}
