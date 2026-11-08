import { Injectable, inject } from '@angular/core';
import { from, map, Observable, switchMap } from 'rxjs';
import {
  Appointment,
  UserProfile,
  Doctor,
  Specialization,
  Paged,
  MedicalRecord,
  Prescription,
  Invoice,
  Notification,
  PaymentRequest,
  CreateAppointmentRequest,
  AppointmentFilter,
  ApiResponse,
} from './models';
import { SupabaseService } from './supabase.service';
import type { ScheduleDay } from '../../doctor/doctor.models';
import type { DatedAvailability } from '../../doctor/doctor.models';
import type { VisitOutcome } from '../../doctor/doctor.models';

function toProfile(row: any): UserProfile {
  return {
    id: row.user_id,
    username: row.username,
    fullName: row.full_name ?? '',
    email: row.email ?? '',
    mobileNumber: row.email ?? '',
    dateOfBirth: '',
    role: (row.role ?? 'patient') as UserProfile['role'],
    status: row.status ?? 'ACTIVE',
    assignedDoctorId: row.assigned_doctor_id,
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
    updatedAt: row.updatedAt,
  };
}

function toDoctor(row: any): Doctor {
  return {
    id: row.id,
    userId: row.user_id,
    fullName: row.full_name,
    specialty: row.specialty,
    specializationId: row.specialization_id,
    licenseNumber: row.license_number,
    yearsOfExperience: row.years_of_experience,
    feeCentavos: row.fee_centavos,
    bio: row.bio,
    building: row.building,
    floor: row.floor,
    room: row.room,
    languages: row.languages,
    status: row.status,
  };
}

function toSpecialization(row: any): Specialization {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? undefined,
  };
}

function toMedicalRecord(row: any): MedicalRecord {
  return {
    id: row.id,
    patientId: row.patient_id,
    title: row.title,
    description: row.description ?? undefined,
    createdAt: row.created_at,
  };
}

function toPrescription(row: any): Prescription {
  return {
    id: row.id,
    appointmentId: row.appointment_id,
    medicine: row.medicine,
    dosage: row.dosage,
    frequency: row.frequency,
    prescribedAt: row.prescribed_at,
  };
}

function toInvoice(row: any): Invoice {
  return {
    id: row.id,
    patientId: row.patient_id,
    amount: row.amount,
    status: row.status,
    dueDate: row.due_date,
  };
}

function toNotification(row: any): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    body: row.body,
    isRead: row.is_read,
    createdAt: row.created_at,
  };
}

@Injectable({ providedIn: 'root' })
export class HttpPatientGateway {
  private supabase = inject(SupabaseService);

  // ---- Profile ----
  getProfile(): Observable<UserProfile> {
    return from(this.supabase.getUser()).pipe(
      switchMap((result: any) => {
        if (result.error || !result.data?.user) {
          throw new Error('Not authenticated');
        }
        return from(
          (this.supabase as any)
            .from('profiles')
            .select('*')
            .eq('user_id', result.data.user.id)
            .single(),
        ).pipe(
          map((profileResult: any) => {
            if (profileResult.error || !profileResult.data) {
              throw new Error('Profile not found');
            }
            return toProfile(profileResult.data);
          }),
        );
      }),
    );
  }

  updateProfile(profile: Partial<UserProfile>): Observable<UserProfile> {
    return from(this.supabase.getUser()).pipe(
      switchMap((result: any) => {
        if (result.error || !result.data?.user) {
          throw new Error('Not authenticated');
        }
        return from(
          (this.supabase as any)
            .from('profiles')
            .update({
              username: profile.username,
              full_name: profile.fullName,
              email: profile.email,
              status: profile.status,
            })
            .eq('user_id', result.data.user.id)
            .select()
            .single(),
        ).pipe(
          map((r: any) => {
            if (r.error || !r.data) {
              throw new Error(r.error?.message ?? 'Update failed');
            }
            return toProfile(r.data);
          }),
        );
      }),
    );
  }

  // ---- Appointments ----
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

  getAppointment(id: string): Observable<Appointment> {
    return from((this.supabase as any).from('appointments').select('*').eq('id', id).single()).pipe(
      map((r: any) => {
        if (r.error || !r.data) {
          throw new Error(r.error?.message ?? 'Appointment not found');
        }
        return toAppointment(r.data);
      }),
    );
  }

  createAppointment(request: CreateAppointmentRequest): Observable<Appointment> {
    return from(this.supabase.getUser()).pipe(
      switchMap((result: any) => {
        if (result.error || !result.data?.user) {
          throw new Error('Not authenticated');
        }
        return from(
          (this.supabase as any).rpc('book_appointment', {
            p_doctor_id: request.doctorId,
            p_starts_at: request.startsAt,
            p_duration_minutes: request.durationMinutes,
            p_reason: request.reason,
          }),
        ).pipe(
          map((r: any) => {
            if (r.error) {
              throw new Error(r.error?.message ?? 'Booking failed');
            }
            // Return a minimal appointment; client refetches if needed.
            return {
              id: r.data,
              patientId: '',
              doctorId: request.doctorId,
              startsAt: request.startsAt,
              durationMinutes: request.durationMinutes,
              status: 'BOOKED',
              reason: request.reason,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            } as Appointment;
          }),
        );
      }),
    );
  }

  // ---- Doctor directory ----
  getDoctors(params?: {
    specializationId?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Observable<Paged<Doctor>> {
    let q = (this.supabase as any).from('doctors').select('*', { count: 'exact' });
    if (params?.specializationId) {
      q = q.eq('specialization_id', params.specializationId);
    }
    if (params?.search) {
      q = q.ilike('full_name', `%${params.search}%`);
    }
    if (params?.limit) {
      q = q.limit(params.limit);
    }
    if (params?.offset) {
      q = q.range(params.offset, params.offset + (params.limit ?? 20) - 1);
    } else if (params?.limit) {
      q = q.range(0, params.limit - 1);
    }
    return from(q).pipe(
      map((r: any) => ({
        items: (r.data ?? []).map(toDoctor),
        total: r.count ?? (r.data ?? []).length,
        limit: params?.limit ?? (r.data ?? []).length,
        offset: params?.offset ?? 0,
      })),
    );
  }

  getDoctor(id: string): Observable<Doctor> {
    return from((this.supabase as any).from('doctors').select('*').eq('id', id).single()).pipe(
      map((r: any) => {
        if (r.error || !r.data) {
          throw new Error(r.error?.message ?? 'Doctor not found');
        }
        return toDoctor(r.data);
      }),
    );
  }

  getSpecializations(): Observable<Specialization[]> {
    return from((this.supabase as any).from('specializations').select('*')).pipe(
      map((r: any) => {
        if (r.error) {
          throw new Error(r.error?.message ?? 'Failed to load specializations');
        }
        return (r.data ?? []).map(toSpecialization);
      }),
    );
  }

  // ---- Medical records ----
  getMedicalRecords(): Observable<MedicalRecord[]> {
    return from(this.supabase.getUser()).pipe(
      switchMap((result: any) => {
        if (result.error || !result.data?.user) {
          throw new Error('Not authenticated');
        }
        return from(
          (this.supabase as any)
            .from('medical_records')
            .select('*')
            .eq('patient_id', result.data.user.id),
        ).pipe(
          map((r: any) => {
            if (r.error) {
              throw new Error(r.error?.message ?? 'Failed to load records');
            }
            return (r.data ?? []).map(toMedicalRecord);
          }),
        );
      }),
    );
  }

  // ---- Prescriptions ----
  getPrescriptions(): Observable<Prescription[]> {
    return from(this.supabase.getUser()).pipe(
      switchMap((result: any) => {
        if (result.error || !result.data?.user) {
          throw new Error('Not authenticated');
        }
        return from(
          (this.supabase as any)
            .from('prescriptions')
            .select('*')
            .eq('patient_id', result.data.user.id),
        ).pipe(
          map((r: any) => {
            if (r.error) {
              throw new Error(r.error?.message ?? 'Failed to load prescriptions');
            }
            return (r.data ?? []).map(toPrescription);
          }),
        );
      }),
    );
  }

  // ---- Invoices / Payments ----
  getInvoices(): Observable<Invoice[]> {
    return from(this.supabase.getUser()).pipe(
      switchMap((result: any) => {
        if (result.error || !result.data?.user) {
          throw new Error('Not authenticated');
        }
        return from(
          (this.supabase as any).from('invoices').select('*').eq('patient_id', result.data.user.id),
        ).pipe(
          map((r: any) => {
            if (r.error) {
              throw new Error(r.error?.message ?? 'Failed to load invoices');
            }
            return (r.data ?? []).map(toInvoice);
          }),
        );
      }),
    );
  }

  payInvoice(request: PaymentRequest): Observable<Invoice> {
    return from(this.supabase.getUser()).pipe(
      switchMap((result: any) => {
        if (result.error || !result.data?.user) {
          throw new Error('Not authenticated');
        }
        return from(
          (this.supabase as any)
            .from('payments')
            .insert({
              invoice_id: request.invoiceId,
              patient_id: result.data.user.id,
              amount: request.amount,
              method: request.method,
            })
            .select()
            .single(),
        ).pipe(
          map((r: any) => {
            if (r.error || !r.data) {
              throw new Error(r.error?.message ?? 'Payment failed');
            }
            return toInvoice(r.data);
          }),
        );
      }),
    );
  }

  // ---- Notifications ----
  getNotifications(): Observable<Notification[]> {
    return from(this.supabase.getUser()).pipe(
      switchMap((result: any) => {
        if (result.error || !result.data?.user) {
          throw new Error('Not authenticated');
        }
        return from(
          (this.supabase as any)
            .from('notifications')
            .select('*')
            .eq('user_id', result.data.user.id),
        ).pipe(
          map((r: any) => {
            if (r.error) {
              throw new Error(r.error?.message ?? 'Failed to load notifications');
            }
            return (r.data ?? []).map(toNotification);
          }),
        );
      }),
    );
  }

  markNotificationAsRead(id: string): Observable<void> {
    return from(
      (this.supabase as any).from('notifications').update({ is_read: true }).eq('id', id),
    ).pipe(
      map((r: any) => {
        if (r.error) {
          throw new Error(r.error?.message ?? 'Failed to mark as read');
        }
      }),
    );
  }

  // ---- Doctor area: weekly schedule ----
  getDoctorSchedule(doctorId: string): Observable<ScheduleDay[]> {
    return from(
      (this.supabase as any).from('clinic_hours').select('*').eq('doctor_id', doctorId),
    ).pipe(
      map((r: any) => {
        if (r.error) {
          throw new Error(r.error?.message ?? 'Failed to load schedule');
        }
        return (r.data ?? []).map((d: any) => ({
          dayOfWeek: d.day_of_week,
          sessions:
            d.start_time && d.end_time ? [{ startTime: d.start_time, endTime: d.end_time }] : [],
        }));
      }),
    );
  }

  saveDoctorSchedule(doctorId: string, days: readonly ScheduleDay[]): Observable<void> {
    return from(
      (this.supabase as any).from('clinic_hours').upsert(
        days.flatMap((d) =>
          d.sessions.map((s) => ({
            doctor_id: doctorId,
            day_of_week: d.dayOfWeek,
            start_time: s.startTime,
            end_time: s.endTime,
            is_closed: false,
          })),
        ),
      ),
    ).pipe(
      map((r: any) => {
        if (r.error) {
          throw new Error(r.error?.message ?? 'Failed to save schedule');
        }
      }),
    );
  }

  // ---- Doctor area: dated availability overrides ----
  getDoctorAvailability(doctorId: string): Observable<DatedAvailability[]> {
    return from(
      (this.supabase as any).from('availabilities').select('*').eq('doctor_id', doctorId),
    ).pipe(
      map((r: any) => {
        if (r.error) {
          throw new Error(r.error?.message ?? 'Failed to load availability');
        }
        return (r.data ?? []).map((d: any) => ({
          date: d.date,
          sessions: d.sessions,
        }));
      }),
    );
  }

  saveDoctorAvailability(doctorId: string, entry: DatedAvailability): Observable<void> {
    return from(
      (this.supabase as any).from('availabilities').upsert({
        doctor_id: doctorId,
        date: entry.date,
        sessions: entry.sessions,
      }),
    ).pipe(
      map((r: any) => {
        if (r.error) {
          throw new Error(r.error?.message ?? 'Failed to save availability');
        }
      }),
    );
  }

  // ---- Doctor area: record visit outcome ----
  recordAppointmentOutcome(appointmentId: string, outcome: VisitOutcome): Observable<Appointment> {
    return from(
      (this.supabase as any).rpc('record_outcome', {
        p_appointment_id: appointmentId,
        p_outcome: outcome,
      }),
    ).pipe(
      map((r: any) => {
        if (r.error) {
          throw new Error(r.error?.message ?? 'Failed to record outcome');
        }
        return {
          id: appointmentId,
          patientId: '',
          doctorId: '',
          startsAt: '',
          durationMinutes: 0,
          status: 'COMPLETED',
          reason: '',
          createdAt: '',
          updatedAt: '',
        } as Appointment;
      }),
    );
  }

  // ---- Doctor area: confirm a booking ----
  confirmAppointment(appointmentId: string): Observable<Appointment> {
    return from(
      (this.supabase as any).rpc('confirm_appointment', {
        p_appointment_id: appointmentId,
      }),
    ).pipe(
      map((r: any) => {
        if (r.error) {
          throw new Error(r.error?.message ?? 'Failed to confirm');
        }
        return {
          id: appointmentId,
          patientId: '',
          doctorId: '',
          startsAt: '',
          durationMinutes: 0,
          status: 'CONFIRMED',
          reason: '',
          createdAt: '',
          updatedAt: '',
        } as Appointment;
      }),
    );
  }

  // ---- Doctor area: appointments for this doctor ----
  getDoctorAppointments(filter?: AppointmentFilter): Observable<Paged<Appointment>> {
    return this.getAppointments({ ...filter, doctorId: filter?.doctorId });
  }

  // ---- Doctor area: patients with appointments ----
  getPatients(doctorId?: string): Observable<UserProfile[]> {
    return from(this.supabase.getUser()).pipe(
      switchMap((result: any) => {
        if (result.error || !result.data?.user) {
          throw new Error('Not authenticated');
        }
        return from(
          (this.supabase as any)
            .from('users')
            .select('user_id, username, full_name, email, role, status')
            .eq('role', 'PATIENT'),
        ).pipe(
          map((r: any) => {
            if (r.error) {
              throw new Error(r.error?.message ?? 'Failed to load patients');
            }
            return (r.data ?? []).map((u: any) => toProfile({ ...u, user_id: u.user_id }));
          }),
        );
      }),
    );
  }
}
