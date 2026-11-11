import { Injectable, computed, signal, inject } from '@angular/core';
import { HttpSecretaryGateway } from '../core/api/http-secretary-gateway';
import { AuthService } from '../core/api/auth.service';
import { Observable, of, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { isSameDay, localIso, minutesOfDay, shortDate, startOfDay } from './secretary.dates';
import type { AccountStatus } from '../shared/domain/account-status';
import type {
  Appointment,
  AppointmentStatus,
  Conversation,
  ConversationMessage,
  ConversationSummary,
  Doctor,
  DoctorSummary,
  Patient,
  PatientSummary,
  ProfileDraft,
  ScheduleDay,
  SecretaryProfile,
} from './secretary.models';

/** A proposed appointment, before it exists as one. */
export interface BookingDraft {
  readonly patientId: string;
  readonly doctorId: string;
  /** Zone-less local timestamp, `YYYY-MM-DDTHH:MM:SS`. */
  readonly startsAt: string;
  readonly durationMinutes: number;
  readonly reason: string;
}

/** Why a proposed appointment cannot go ahead, or `null` when it can. */
export type BookingRefusal =
  | 'no-patient'
  | 'no-doctor'
  | 'not-your-doctor'
  | 'inactive-doctor'
  | 'day-closed'
  | 'outside-hours'
  | 'ends-after-close'
  | 'doctor-busy'
  | 'not-in-the-future';

/** A status that ends an appointment's life, so it can no longer be acted on. */
export const CLOSED_STATUSES: readonly AppointmentStatus[] = ['completed', 'cancelled', 'no-show'];

/** Statuses that mean the patient is expected to turn up. */
const LIVE_STATUSES: readonly AppointmentStatus[] = ['booked', 'confirmed'];

const byStart = (a: Appointment, b: Appointment): number => a.startsAt.localeCompare(b.startsAt);

/** Most recent first, for a record of what has already been dealt with. */
const byStartNewest = (a: Appointment, b: Appointment): number => byStart(b, a);

const EMPTY_PROFILE: SecretaryProfile = {
  id: '',
  name: '',
  email: '',
  phone: '',
  joinedOn: '',
  assignedDoctorId: null,
};

/**
 * Secretary session backed by the real Ktor API.
 *
 * Fetches profile, appointments, patients, doctors and conversations on init,
 * keeps them in signals, and every page keeps working exactly as before because
 * all the computeds and mutation methods have the same shape â€” they just
 * read/write API-backed signals instead of in-memory fixtures.
 *
 * Everything is scoped to one doctor: the one an administrator assigned this
 * Secretary to. `assignedDoctorId` comes from the signed-in profile, and every
 * list, every count and every lookup is filtered through `isOnDesk` before a
 * page can reach it.
 *
 * Mutations go to the API first and update signals optimistically.
 */
@Injectable()
export class SecretarySession {
  private readonly gateway = inject(HttpSecretaryGateway);
  private readonly auth = inject(AuthService);

  private readonly profileState = signal<SecretaryProfile>(EMPTY_PROFILE);
  private readonly appointmentState = signal<Appointment[]>([]);
  private readonly patientState = signal<Patient[]>([]);
  private readonly doctorState = signal<Doctor[]>([]);
  private readonly scheduleState = signal<Record<string, ScheduleDay[]>>({});
  private readonly conversationState = signal<Conversation[]>([]);
  private readonly messageState = signal<ConversationMessage[]>([]);

  /**
   * The area's single clock.
   *
   * A signal rather than `new Date()` inside the computeds: a `computed` that
   * read the wall clock would be correct only for the first read and cached
   * forever after, so an app left open across midnight would keep showing
   * yesterday.
   */
  readonly now = signal(new Date());

  readonly profile = computed(() => this.profileState());

  /**
   * The doctor whose desk this Secretary works, or `null` while unassigned.
   */
  readonly assignedDoctor = computed<Doctor | null>(() => {
    const id = this.profileState().assignedDoctorId;
    return id ? this.doctorById(id) : null;
  });

  /**
   * What an unassigned desk says for itself.
   */
  readonly unassignedMessage =
    'You are not assigned to a doctor yet. Ask an administrator to assign you to one.';

  /**
   * Whether a record belongs to this Secretary's desk.
   */
  private isOnDesk(doctorId: string): boolean {
    return this.profileState().assignedDoctorId === doctorId;
  }

  /**
   * Whether a conversation belongs to this desk.
   */
  private isConversationOnDesk(conversation: Conversation): boolean {
    if (conversation.party === 'doctor') return this.isOnDesk(conversation.partyId);
    const patient = this.patientState().find((candidate) => candidate.id === conversation.partyId);
    return !!patient && this.isOnDesk(patient.doctorId);
  }

  /** The assigned doctor's appointments, soonest first. */
  readonly appointments = computed(() =>
    this.appointmentState()
      .filter((appointment) => this.isOnDesk(appointment.doctorId))
      .sort(byStart),
  );

  /** Today's list, cancelled appointments dropped so the day reads as a plan. */
  readonly todaysAppointments = computed(() => {
    const now = this.now();
    return this.appointments().filter(
      (appointment) =>
        isSameDay(new Date(appointment.startsAt), now) &&
        !CLOSED_STATUSES.includes(appointment.status),
    );
  });

  /** The next appointment still to happen, or `null` when the list is clear. */
  readonly nextAppointment = computed(() => {
    const now = this.now().getTime();
    return (
      this.appointments().find(
        (appointment) =>
          LIVE_STATUSES.includes(appointment.status) &&
          new Date(appointment.startsAt).getTime() >= now,
      ) ?? null
    );
  });

  /** Booked but not yet confirmed by the patient â€” the queue needing a reminder. */
  readonly awaitingConfirmation = computed(() =>
    this.appointments().filter((appointment) => appointment.status === 'booked'),
  );

  /** Consultations that happened in the seven days up to `now`. */
  readonly completedThisWeek = computed(() => {
    const since = startOfDay(this.now()).getTime() - 6 * 24 * 60 * 60 * 1000;
    return this.appointments().filter(
      (appointment) =>
        appointment.status === 'completed' && new Date(appointment.startsAt).getTime() >= since,
    );
  });

  /**
   * Appointments this desk has closed, newest first.
   */
  readonly deskHistory = computed(() =>
    this.appointments()
      .filter((appointment) => CLOSED_STATUSES.includes(appointment.status))
      .sort(byStartNewest),
  );

  /**
   * The assigned doctor's patients, with their visit figures.
   */
  readonly patients = computed<PatientSummary[]>(() => {
    const all = this.appointments();
    const now = this.now().getTime();

    return this.patientState()
      .filter((patient) => this.isOnDesk(patient.doctorId))
      .map((patient): PatientSummary => {
        const history = all
          .filter((appointment) => appointment.patientId === patient.id)
          .sort(byStart);
        const past = history.filter(
          (appointment) => new Date(appointment.startsAt).getTime() < now,
        );
        const future = history.filter(
          (appointment) =>
            new Date(appointment.startsAt).getTime() >= now &&
            !CLOSED_STATUSES.includes(appointment.status),
        );

        return {
          patient,
          lastVisit: past.length ? past[past.length - 1] : null,
          nextVisit: future.length ? future[0] : null,
          visitCount: history.filter(
            (appointment) => appointment.status === 'completed' || appointment.status === 'no-show',
          ).length,
        };
      });
  });

  /**
   * The assigned doctor, with the availability the Secretary needs when booking.
   */
  readonly doctors = computed<DoctorSummary[]>(() => {
    const now = this.now().getTime();
    return this.doctorState()
      .filter((doctor) => this.isOnDesk(doctor.id))
      .map((doctor) => {
        const days = this.schedule()[doctor.id] ?? [];
        const weekly = days.reduce((total, day) => total + this.dayMinutes(day), 0);
        const nextLive = this.appointments()
          .filter(
            (appointment) =>
              LIVE_STATUSES.includes(appointment.status) &&
              new Date(appointment.startsAt).getTime() >= now,
          )
          .sort(byStart)[0];

        return {
          doctor,
          weeklyHours: weekly ? formatWeekHours(weekly) : 'Not taking bookings',
          nextAvailable: nextLive?.startsAt ?? null,
        };
      });
  });

  /**
   * How many doctors this desk can book with: one, or none while unassigned.
   */
  readonly activeDoctorCount = computed(
    () => this.doctors().filter((summary) => summary.doctor.status === 'active').length,
  );

  /**
   * The assigned doctor's published week, Sunday-first.
   */
  readonly schedule = computed(() =>
    Object.fromEntries(
      Object.entries(this.scheduleState())
        .filter(([id]) => this.isOnDesk(id))
        .map(([id, days]) => [id, [...days].sort((a, b) => a.dayOfWeek - b.dayOfWeek)]),
    ),
  );

  // ---------------------------------------------------------------------------
  // Messaging
  // ---------------------------------------------------------------------------

  /**
   * This desk's threads, most recently active first.
   */
  readonly conversations = computed<ConversationSummary[]>(() => {
    const messages = this.messageState();

    return this.conversationState()
      .filter((conversation) => this.isConversationOnDesk(conversation))
      .map((conversation): ConversationSummary => {
        const thread = messages
          .filter((message) => message.conversationId === conversation.id)
          .sort((a, b) => a.sentAt.localeCompare(b.sentAt));
        const newest = thread[thread.length - 1];

        return {
          conversation,
          name: this.partyName(conversation),
          messages: thread,
          unreadCount: thread.filter((m) => !m.fromSecretary && m.readAt === null).length,
          lastSentAt: newest?.sentAt ?? '',
          preview: newest ? oneline(newest.body) : '',
          lastFromSecretary: newest?.fromSecretary ?? true,
        };
      })
      .sort((a, b) => b.lastSentAt.localeCompare(a.lastSentAt));
  });

  /** Messages waiting to be read, across every thread. */
  readonly unreadMessageCount = computed(() =>
    this.conversations().reduce((total, summary) => total + summary.unreadCount, 0),
  );

  /** How many of this desk's threads still owe the clinic something. */
  readonly awaitingActionCount = computed(
    () => this.conversations().filter((summary) => summary.conversation.awaitingAction).length,
  );

  /** One thread, or `null` for an id that matches none. */
  conversationById(id: string): ConversationSummary | null {
    return this.conversations().find((summary) => summary.conversation.id === id) ?? null;
  }

  /**
   * The line under a name in the thread header.
   */
  conversationSubtitle(conversation: Conversation): string {
    if (conversation.party === 'doctor') {
      const doctor = this.doctorById(conversation.partyId);
      return doctor ? `Doctor Â· ${doctor.specialization}` : 'Doctor';
    }

    const summary = this.patients().find((entry) => entry.patient.id === conversation.partyId);
    if (!summary) return 'Patient';

    if (summary.nextVisit) {
      return `Patient Â· Next visit ${shortDate(new Date(summary.nextVisit.startsAt))}`;
    }
    return summary.visitCount
      ? `Patient Â· ${summary.visitCount} visit${summary.visitCount === 1 ? '' : 's'}`
      : 'Patient Â· Not yet seen';
  }

  /**
   * Marks everything the other party sent in a thread as read.
   *
   * Optimistic: flags flip immediately, then the API call is fired and rolled
   * back on error â€” same shape as confirm/cancel.
   */
  markConversationRead(conversationId: string): boolean {
    if (!this.conversations().some((summary) => summary.conversation.id === conversationId)) {
      return false;
    }

    const at = localIso(this.now());
    let changed = false;

    this.messageState.update((messages) =>
      messages.map((message) => {
        if (message.conversationId !== conversationId) return message;
        if (message.fromSecretary || message.readAt !== null) return message;
        changed = true;
        return { ...message, readAt: at };
      }),
    );

    this.gateway.markConversationRead(conversationId).subscribe({
      error: () => {
        this.messageState.update((messages) =>
          messages.map((message) => {
            if (message.conversationId !== conversationId) return message;
            if (message.fromSecretary || message.readAt === null) return message;
            return { ...message, readAt: null };
          }),
        );
      },
    });

    return changed;
  }

  /**
   * Appends a reply from the signed-in Secretary.
   *
   * Optimistic: the bubble appears immediately, then the API call is fired
   * and rolled back on error â€” same shape as confirm/cancel.
   */
  sendMessage(conversationId: string, body: string): Observable<ConversationMessage | null> {
    const text = body.trim();
    if (!text) return of(null);
    if (!this.conversations().some((summary) => summary.conversation.id === conversationId)) {
      return of(null);
    }

    const message: ConversationMessage = {
      id: this.nextMessageId(),
      conversationId,
      sentAt: localIso(this.now()),
      body: text,
      fromSecretary: true,
      readAt: localIso(this.now()),
    };

    // Optimistic update: the bubble appears immediately, synchronously.
    this.messageState.update((messages) => [...messages, message]);

    // API call: fires when the caller subscribes. On error, roll back and propagate.
    return this.gateway.sendMessage(conversationId, text).pipe(
      map(() => message),
      catchError((err) => {
        this.messageState.update((messages) => messages.filter((m) => m.id !== message.id));
        return throwError(() => err);
      }),
    );
  }

  /**
   * Loads the messages of one conversation into the shared message store,
   * merged in without duplicating ids. Called when a thread is opened.
   */
  loadConversationMessages(conversationId: string): void {
    this.gateway.getConversationMessages(conversationId).subscribe({
      next: (messages) => {
        this.messageState.update((existing) => {
          const ids = new Set(existing.map((m) => m.id));
          return [...existing, ...messages.filter((m) => !ids.has(m.id))];
        });
      },
      error: () => {},
    });
  }

  private nextMessageId(): string {
    const used = this.messageState().map((message) => message.id);
    let highest = 0;
    for (const id of used) {
      const parsed = Number(id.replace('msg-', ''));
      if (Number.isFinite(parsed) && parsed > highest) highest = parsed;
    }
    return `msg-${String(highest + 1).padStart(4, '0')}`;
  }

  /**
   * A conversation's name, from the patient or doctor fixtures.
   */
  private partyName(conversation: Conversation): string {
    return conversation.party === 'doctor'
      ? (this.doctorById(conversation.partyId)?.name ?? 'Unknown doctor')
      : (this.patientById(conversation.partyId)?.name ?? 'Unknown patient');
  }

  /**
   * One of this desk's patients, or `null` for an id that is not on it.
   */
  patientById(id: string): Patient | null {
    const patient = this.patientState().find((candidate) => candidate.id === id);
    return patient && this.isOnDesk(patient.doctorId) ? patient : null;
  }

  /**
   * A doctor by id, unscoped. Matches by doctors.id or by auth user_id, since
   * appointment rows store the latter in doctor_id.
   */
  doctorById(id: string): Doctor | null {
    return this.doctorState().find((doctor) => doctor.id === id || doctor.userId === id) ?? null;
  }

  /**
   * A patient's appointments on this desk, soonest first.
   */
  appointmentsForPatient(patientId: string): Appointment[] {
    return this.appointments().filter((appointment) => appointment.patientId === patientId);
  }

  /**
   * A doctor's appointments, soonest first.
   */
  appointmentsForDoctor(doctorId: string): Appointment[] {
    return this.appointments().filter((appointment) => appointment.doctorId === doctorId);
  }

  /** Name for a table cell, so a missing patient never renders as `undefined`. */
  patientName(patientId: string): string {
    return this.patientById(patientId)?.name ?? 'Unknown patient';
  }

  /** Name for a table cell, so a missing doctor never renders as `undefined`. */
  doctorName(doctorId: string): string {
    return this.doctorById(doctorId)?.name ?? 'Unknown doctor';
  }

  /** A doctor's published week, or an empty list rather than a throw. */
  scheduleFor(doctorId: string): ScheduleDay[] {
    return this.schedule()[doctorId] ?? [];
  }

  /** Minutes published on one day, or zero when the day is closed or invalid. */
  dayMinutes(day: ScheduleDay): number {
    if (!day.enabled) return 0;
    const start = minutesOfDay(day.startTime);
    const end = minutesOfDay(day.endTime);
    if (start === null || end === null || end <= start) return 0;
    return end - start;
  }

  /** Minutes a doctor publishes across the whole week. */
  weeklyMinutes(doctorId: string): number {
    return this.scheduleFor(doctorId).reduce((total, day) => total + this.dayMinutes(day), 0);
  }

  /**
   * Whether a proposed appointment is allowed, and why not if it is not.
   */
  bookingRefusal(draft: BookingDraft, ignoreId?: string): BookingRefusal | null {
    if (!draft.patientId || !this.patientById(draft.patientId)) return 'no-patient';

    const doctor = this.doctorById(draft.doctorId);
    if (!doctor) return 'no-doctor';
    if (!this.isOnDesk(draft.doctorId)) return 'not-your-doctor';
    if (doctor.status !== 'active') return 'inactive-doctor';

    const startsAt = new Date(draft.startsAt);
    if (Number.isNaN(startsAt.getTime())) return 'not-in-the-future';
    if (startsAt.getTime() < this.now().getTime()) return 'not-in-the-future';

    const day = this.scheduleFor(draft.doctorId).find((d) => d.dayOfWeek === startsAt.getDay());
    if (!day?.enabled) return 'day-closed';

    const open = minutesOfDay(day.startTime);
    const close = minutesOfDay(day.endTime);
    const startMinutes = startsAt.getHours() * 60 + startsAt.getMinutes();
    if (open === null || close === null || startMinutes < open) return 'outside-hours';
    if (startMinutes + draft.durationMinutes > close) return 'ends-after-close';

    const clash = this.appointments().some((appointment) => {
      if (appointment.id === ignoreId) return false;
      if (appointment.doctorId !== draft.doctorId) return false;
      if (CLOSED_STATUSES.includes(appointment.status)) return false;

      const existingStart = new Date(appointment.startsAt).getTime();
      const existingEnd = existingStart + appointment.durationMinutes * 60_000;
      const proposedStart = startsAt.getTime();
      const proposedEnd = proposedStart + draft.durationMinutes * 60_000;
      return proposedStart < existingEnd && existingStart < proposedEnd;
    });
    if (clash) return 'doctor-busy';

    return null;
  }

  /**
   * Confirms a booked appointment on this desk.
   */
  confirm(id: string): boolean {
    const current = this.appointmentState().find((appointment) => appointment.id === id);
    if (!current || !this.isOnDesk(current.doctorId)) return false;
    if (current.status !== 'booked') return false;

    this.appointmentState.update((appointments) =>
      appointments.map((appointment) =>
        appointment.id === id ? { ...appointment, status: 'confirmed' as const } : appointment,
      ),
    );
    this.gateway.confirmAppointment(id).subscribe({
      error: () => {
        this.appointmentState.update((appointments) =>
          appointments.map((appointment) =>
            appointment.id === id ? { ...appointment, status: 'booked' as const } : appointment,
          ),
        );
      },
    });
    return true;
  }

  /**
   * Cancels an appointment on this desk.
   */
  cancel(id: string): boolean {
    const current = this.appointmentState().find((appointment) => appointment.id === id);
    if (!current || !this.isOnDesk(current.doctorId)) return false;
    if (CLOSED_STATUSES.includes(current.status)) return false;

    this.appointmentState.update((appointments) =>
      appointments.map((appointment) =>
        appointment.id === id ? { ...appointment, status: 'cancelled' as const } : appointment,
      ),
    );
    this.gateway.cancelAppointment(id).subscribe({
      error: () => {
        this.appointmentState.update((appointments) =>
          appointments.map((appointment) =>
            appointment.id === id ? { ...appointment, status: current.status } : appointment,
          ),
        );
      },
    });
    return true;
  }

  /**
   * Applies the fields the Profile page is allowed to change.
   */
  updateProfile(draft: ProfileDraft): void {
    this.profileState.update((profile) => ({
      ...profile,
      name: draft.name,
      email: draft.email,
      phone: draft.phone,
    }));
  }

  // ---------------------------------------------------------------------------
  // Initial load from the API
  // ---------------------------------------------------------------------------
  constructor() {
    // Profile first â€” everything else needs assignedDoctorId.
    const p = this.auth.profile;
    if (p) {
      this.profileState.set({
        id: p.id,
        name: p.fullName,
        email: p.email ?? '',
        phone: p.mobileNumber ?? '',
        joinedOn: p.joinedOn ?? '',
        assignedDoctorId: p.assignedDoctorId ?? null,
      });
    }

    this.gateway.getAppointments().subscribe({
      next: (appointments) => this.appointmentState.set(appointments as unknown as Appointment[]),
      error: () => {},
    });

    this.gateway.getPatients().subscribe({
      next: (profiles) => {
        const deskDoctorId = this.profileState().assignedDoctorId;
        this.patientState.set(
          profiles.map((p) => ({
            id: p.id,
            name: p.fullName,
            email: p.email ?? '',
            phone: p.mobileNumber ?? '',
            dateOfBirth: p.dateOfBirth,
            address: '',
            registeredOn: p.dateOfBirth,
            status: 'active' as AccountStatus,
            // These patients are returned because they have appointments with
            // this desk's doctor, so scope them to the assigned doctor id.
            doctorId: deskDoctorId ?? '',
          })),
        );
      },
      error: () => {},
    });

    this.gateway.getMessages().subscribe({
      next: (threads) => {
        this.conversationState.set(
          threads.map((t) => ({
            id: t.id,
            party: t.patientId ? ('patient' as const) : ('doctor' as const),
            partyId: t.patientId ?? t.doctorId ?? '',
            awaitingAction: t.awaitingAction,
          })),
        );
        this.messageState.set(
          threads.flatMap((t) =>
            // Threads don't carry messages in the summary endpoint; messages
            // are loaded per-conversation when the thread is opened.
            [],
          ),
        );
      },
      error: () => {},
    });

    // The assigned doctor and their published hours. Loaded once at startup so
    // the dashboard can name the desk's doctor and the schedules page can show
    // the week. Both come from the secretary's own profile: assignedDoctorId
    // identifies the doctor, and the schedule endpoint publishes their hours.
    this.gateway.getDoctor().subscribe({
      next: (doctor) => {
        if (!doctor) {
          return;
        }
        this.doctorState.set([
          {
            id: doctor.id,
            userId: doctor.userId,
            name: doctor.fullName,
            email: '',
            phone: '',
            specialization: doctor.specialty,
            licenseNumber: doctor.licenseNumber,
            joinedOn: '',
            status: doctor.status as AccountStatus,
          },
        ]);

        this.gateway.getDoctorSchedule(doctor.id).subscribe({
          next: (hours) => {
            this.scheduleState.set({
              [doctor.id]: hours.map((h) => ({
                dayOfWeek: h.dayOfWeek,
                enabled: !h.isClosed,
                startTime: h.startTime,
                endTime: h.endTime,
              })),
            });
          },
          error: () => {},
        });
      },
      error: () => {},
    });
  }
}

function formatWeekHours(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (!hours) return `${mins}m a week`;
  return mins ? `${hours}h ${mins}m a week` : `${hours}h a week`;
}

function oneline(body: string, limit = 110): string {
  const flat = body.replace(/\s+/g, ' ').trim();
  return flat.length > limit ? `${flat.slice(0, limit - 1).trimEnd()}â€¦` : flat;
}
