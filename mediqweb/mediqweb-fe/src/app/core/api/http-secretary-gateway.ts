import { Injectable, inject } from '@angular/core';
import { from, map, Observable, switchMap } from 'rxjs';
import { UserProfile, Appointment, MessageThread, Message, Doctor } from './models';
import { SupabaseService } from './supabase.service';
import type { Conversation } from '../../secretary/secretary.models';
import type { ConversationMessage } from '../../secretary/secretary.models';

function toConversationMessage(m: Message): ConversationMessage {
  return {
    id: m.id,
    conversationId: m.conversationId,
    sentAt: m.sentAt,
    body: m.body,
    fromSecretary: m.authorRole === 'secretary',
    readAt: m.readAt ?? null,
  };
}

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

function toThread(row: any): MessageThread {
  return {
    id: row.id,
    patientId: row.patient_id,
    doctorId: row.doctor_id,
    subject: row.subject,
    lastMessageAt: row.last_message_at,
    unreadCount: row.unread_count,
    awaitingAction: row.awaiting_action,
  };
}

function toMessage(row: any): Message {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    authorId: row.author_id,
    authorRole: row.author_role,
    body: row.body,
    sentAt: row.sent_at,
    readAt: row.read_at ?? undefined,
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

@Injectable({ providedIn: 'root' })
export class HttpSecretaryGateway {
  private supabase = inject(SupabaseService);

  getAppointments(): Observable<Appointment[]> {
    return from((this.supabase as any).from('appointments').select('*')).pipe(
      map((r: any) => {
        if (r.error) {
          throw new Error(r.error?.message ?? 'Failed to load appointments');
        }
        return (r.data ?? []).map((a: any) => ({
          id: a.id,
          patientId: a.patient_id,
          doctorId: a.doctor_id,
          startsAt: a.starts_at,
          durationMinutes: a.duration_minutes,
          status: a.status,
          reason: a.reason,
          createdAt: a.created_at,
          updatedAt: a.updated_at,
        }));
      }),
    );
  }

  confirmAppointment(id: string): Observable<void> {
    return from((this.supabase as any).rpc('confirm_appointment', { p_appointment_id: id })).pipe(
      map((r: any) => {
        if (r.error) {
          throw new Error(r.error?.message ?? 'Failed to confirm');
        }
      }),
    );
  }

  cancelAppointment(id: string): Observable<void> {
    return from((this.supabase as any).rpc('cancel_appointment', { p_appointment_id: id })).pipe(
      map((r: any) => {
        if (r.error) {
          throw new Error(r.error?.message ?? 'Failed to cancel');
        }
      }),
    );
  }

  getPatients(): Observable<UserProfile[]> {
    return from(this.supabase.getUser()).pipe(
      switchMap((result: any) => {
        if (result.error || !result.data?.user) {
          throw new Error('Not authenticated');
        }
        return from((this.supabase as any).from('profiles').select('*').eq('role', 'PATIENT')).pipe(
          map((r: any) => {
            if (r.error) {
              throw new Error(r.error?.message ?? 'Failed to load patients');
            }
            return (r.data ?? []).map(toProfile);
          }),
        );
      }),
    );
  }

  getMessages(): Observable<MessageThread[]> {
    return from(this.supabase.getUser()).pipe(
      switchMap((result: any) => {
        if (result.error || !result.data?.user) {
          throw new Error('Not authenticated');
        }
        return from(
          (this.supabase as any)
            .from('message_threads')
            .select('*')
            .or(`patient_id.eq.${result.data.user.id},doctor_id.eq.${result.data.user.id}`),
        ).pipe(
          map((r: any) => {
            if (r.error) {
              throw new Error(r.error?.message ?? 'Failed to load threads');
            }
            return (r.data ?? []).map(toThread);
          }),
        );
      }),
    );
  }

  getConversation(id: string): Observable<Conversation> {
    return from(
      (this.supabase as any).from('message_threads').select('*').eq('id', id).single(),
    ).pipe(
      map((r: any) => {
        if (r.error || !r.data) {
          throw new Error(r.error?.message ?? 'Conversation not found');
        }
        const t = r.data;
        return {
          id: t.id,
          party: 'patient' as const,
          partyId: t.patient_id,
          awaitingAction: t.awaiting_action,
        } as Conversation;
      }),
    );
  }

  getConversationMessages(conversationId: string): Observable<ConversationMessage[]> {
    return from(
      (this.supabase as any)
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('sent_at', { ascending: true }),
    ).pipe(
      map((r: any) => {
        if (r.error) {
          throw new Error(r.error?.message ?? 'Failed to load messages');
        }
        return (r.data ?? []).map(toMessage).map(toConversationMessage);
      }),
    );
  }

  getDoctor(): Observable<Doctor> {
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
          switchMap((profileResult: any) => {
            if (profileResult.error || !profileResult.data) {
              throw new Error('Profile not found');
            }
            return from(
              (this.supabase as any)
                .from('doctors')
                .select('*')
                .eq('user_id', profileResult.data.user_id)
                .single(),
            ).pipe(
              map((r: any) => {
                if (r.error || !r.data) {
                  throw new Error(r.error?.message ?? 'Doctor not found');
                }
                return toDoctor(r.data);
              }),
            );
          }),
        );
      }),
    );
  }

  getDoctorSchedule(doctorId: string): Observable<any[]> {
    return from(
      (this.supabase as any).from('clinic_hours').select('*').eq('doctor_id', doctorId),
    ).pipe(
      map((r: any) => {
        if (r.error) {
          throw new Error(r.error?.message ?? 'Failed to load schedule');
        }
        return (r.data ?? []).map((d: any) => ({
          dayOfWeek: d.day_of_week,
          startTime: d.start_time,
          endTime: d.end_time,
          isClosed: d.is_closed,
        }));
      }),
    );
  }

  sendMessage(conversationId: string, body: string): Observable<ConversationMessage> {
    return from(this.supabase.getUser()).pipe(
      switchMap((result: any) => {
        if (result.error || !result.data?.user) {
          throw new Error('Not authenticated');
        }
        return from(
          (this.supabase as any).rpc('send_message', {
            p_conversation_id: conversationId,
            p_body: body,
          }),
        ).pipe(
          switchMap((r: any) => {
            if (r.error) {
              throw new Error(r.error?.message ?? 'Failed to send message');
            }
            return this.getConversationMessages(conversationId).pipe(
              map((msgs) => msgs[msgs.length - 1]),
            );
          }),
        );
      }),
    );
  }

  markConversationRead(conversationId: string): Observable<void> {
    return from(
      (this.supabase as any)
        .from('message_threads')
        .update({ unread_count: 0, awaiting_action: false })
        .eq('id', conversationId),
    ).pipe(
      map((r: any) => {
        if (r.error) {
          throw new Error(r.error?.message ?? 'Failed to mark as read');
        }
      }),
    );
  }
}
