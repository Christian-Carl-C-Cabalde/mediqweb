import { Injectable, inject } from '@angular/core';
import { from, map, Observable, switchMap } from 'rxjs';
import type { StaffAccount, StaffDraft, AuditEntry, AuditSeverity } from '../../admin/admin.models';
import type { PatientAccount } from '../../admin/admin.models';
import type { AccountStatus } from '../../shared/domain/account-status';
import { SupabaseService } from './supabase.service';
import type { Appointment, AppointmentFilter, Paged } from './models';

function toStaffAccount(row: any): StaffAccount {
  return {
    id: row.user_id,
    name: row.full_name ?? '',
    email: row.email ?? '',
    username: row.username,
    status: row.status,
    role: row.role,
    specializationId: null,
    licenseNumber: null,
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
            .single(),
        ).pipe(
          switchMap((adminResult: any) => {
            if (adminResult.error || !adminResult.data) {
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
        return from(
          (this.supabase as any)
            .from('profiles')
            .insert({
              username: draft.username,
              full_name: draft.name,
              email: draft.email,
              role: kind.toUpperCase(),
              status: 'ACTIVE',
            })
            .select()
            .single(),
        ).pipe(
          map((r: any) => {
            if (r.error || !r.data) {
              throw new Error(r.error?.message ?? 'Failed to create account');
            }
            return toStaffAccount(r.data);
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
        .single(),
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
        .single(),
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
      (this.supabase as any).from('doctors').select('id, specialization_id, license_number'),
    ).pipe(
      map((r: any) => {
        if (r.error) {
          throw new Error(r.error?.message ?? 'Failed to load doctor specializations');
        }
        return new Map(
          (r.data ?? []).map((d: any) => [
            d.id,
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
}
