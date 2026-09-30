import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  AppointmentStatusBadge,
  Avatar,
  Button,
  Card,
  Dropdown,
  FilterBar,
  FormField,
  MockNotice,
  Modal,
  Table,
  TableCell,
  type DropdownItem,
  type TableColumn,
} from '../../../shared/components';
import { DAY_NAMES, formatDuration, localIso } from '../../secretary.dates';
import { type BookingDraft, type BookingRefusal, SecretarySession } from '../../secretary-session';
import type { Appointment, AppointmentStatus } from '../../secretary.models';

type StatusFilter = 'all' | AppointmentStatus;
type DoctorFilter = 'all' | string;

const STATUS_ITEMS: DropdownItem[] = [
  { id: 'all', label: 'All statuses' },
  { id: 'booked', label: 'Booked' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'no-show', label: 'No-show' },
];

const ALL_DOCTORS: DropdownItem = { id: 'all', label: 'All doctors' };

/** Bookable lengths, matching the durations the fixtures use. */
const LENGTHS = [15, 30, 45, 60] as const;

/** An appointment can still be moved or called off while the patient is expected. */
const LIVE: readonly AppointmentStatus[] = ['booked', 'confirmed'];

/**
 * A short confirmation after an action.
 *
 * `at` is the raw timestamp rather than a formatted string so the template can
 * render it with the `date` pipe and get locale formatting for free; formatting
 * it in the component would need a second, parallel date formatter.
 */
interface Notice {
  readonly text: string;
  readonly at?: string;
}

/**
 * Why a booking was refused, in words.
 *
 * The store answers with a code so the rules live in one place; this turns each
 * code into the sentence a secretary reads. A `Record` so a new refusal is a
 * compile error here rather than an empty message on screen.
 */
const REFUSAL_TEXT: Record<BookingRefusal, string> = {
  'no-patient': 'Choose the patient this appointment is for.',
  'no-doctor': 'Choose a doctor.',
  'inactive-doctor': 'That doctor is not taking bookings. Choose another one.',
  'day-closed': 'The doctor does not work on that day. Pick another day.',
  'outside-hours': 'That time is before the doctor opens. Pick a later time.',
  'ends-after-close': 'That appointment would run past the doctor closing time.',
  'doctor-busy': 'The doctor already has an appointment at that time.',
  'not-in-the-future': 'That time has already passed. Pick a time in the future.',
};

/**
 * Appointment management: the Secretary's main screen.
 *
 * Booking, moving and calling off appointments is the job. Unlike the Doctor's
 * version of this page, a Secretary creates appointments and changes their time —
 * confirming, completing and recording a no-show are the doctor's decisions and
 * are deliberately not offered here.
 *
 * The booking rules (inside published hours, no clash, doctor active) are asked
 * of the store rather than reimplemented here, so the reason shown next to the
 * form and the reason the store refuses on cannot disagree.
 */
@Component({
  selector: 'app-secretary-appointments',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    AppointmentStatusBadge,
    Avatar,
    Button,
    Card,
    Dropdown,
    FilterBar,
    FormField,
    MockNotice,
    Modal,
    Table,
    TableCell,
  ],
  templateUrl: './secretary-appointments.html',
  styleUrl: './secretary-appointments.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretaryAppointments {
  private readonly session = inject(SecretarySession);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly query = signal('');
  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly doctorFilter = signal<DoctorFilter>('all');
  protected readonly confirmCancelFor = signal<Appointment | null>(null);
  protected readonly rescheduleFor = signal<Appointment | null>(null);
  protected readonly notice = signal<Notice | null>(null);

  protected readonly dayNames = DAY_NAMES;
  protected readonly lengths = LENGTHS;

  protected readonly statusOptions = STATUS_ITEMS;

  protected readonly doctorOptions = computed<DropdownItem[]>(() => [
    ALL_DOCTORS,
    ...this.session.doctors().map((summary) => ({
      id: summary.doctor.id,
      label: summary.doctor.name,
      description: summary.doctor.specialization,
      // An inactive doctor can still be filtered on — there is history to find —
      // but cannot be booked, which is a rule on the booking form, not here.
      disabled: false,
    })),
  ]);

  protected readonly columns: TableColumn<Appointment>[] = [
    { key: 'startsAt', header: 'When', sortable: true },
    { key: 'patientId', header: 'Patient' },
    { key: 'doctorId', header: 'Doctor' },
    { key: 'reason', header: 'Reason', hideBelow: 'lg' },
    { key: 'durationMinutes', header: 'Length', hideBelow: 'lg' },
    { key: 'status', header: 'Status', sortable: true },
    { key: 'actions', header: 'Actions', align: 'end' },
  ];

  /** Patients offered in the booking form, alphabetical by name. */
  protected readonly patientOptions = computed(() =>
    this.session
      .patients()
      .map((summary) => summary.patient)
      .sort((a, b) => a.name.localeCompare(b.name)),
  );

  /** Doctors offered in the booking form. Inactive ones are disabled. */
  protected readonly bookableDoctors = computed(() =>
    this.session.doctors().filter((summary) => summary.doctor.status === 'active'),
  );

  protected readonly bookingForm = this.fb.group({
    patientId: this.fb.control('', Validators.required),
    doctorId: this.fb.control('', Validators.required),
    date: this.fb.control('', Validators.required),
    time: this.fb.control('09:00', Validators.required),
    duration: this.fb.control(30, Validators.required),
    reason: this.fb.control('', [Validators.required, Validators.minLength(3)]),
  });

  protected readonly rescheduleForm = this.fb.group({
    date: this.fb.control('', Validators.required),
    time: this.fb.control('09:00', Validators.required),
  });

  /**
   * Bumped whenever either form changes.
   *
   * Form values are not signals, so a template reading one would not be marked
   * dirty when a dropdown changes. A page-local counter is what makes the
   * dependent bindings — the refusal message, the disabled submit — update.
   */
  private readonly formChanged = signal(0);

  protected readonly appointments = computed(() => {
    this.formChanged();
    const term = this.query().trim().toLowerCase();
    const status = this.statusFilter();
    const doctor = this.doctorFilter();

    return this.session.appointments().filter((appointment) => {
      if (status !== 'all' && appointment.status !== status) return false;
      if (doctor !== 'all' && appointment.doctorId !== doctor) return false;
      if (!term) return true;
      // Search the patient's and the doctor's name as well as the reason,
      // otherwise typing "Lim" to find the cardiologist finds nothing and the box
      // looks broken.
      return (
        this.session.patientName(appointment.patientId).toLowerCase().includes(term) ||
        this.session.doctorName(appointment.doctorId).toLowerCase().includes(term) ||
        appointment.reason.toLowerCase().includes(term)
      );
    });
  });

  protected readonly totalCount = computed(() => this.session.appointments().length);

  /** Still expected to happen: booked or confirmed, cancelled ones excluded. */
  protected readonly openCount = computed(
    () =>
      this.session.appointments().filter((a) => a.status === 'booked' || a.status === 'confirmed')
        .length,
  );

  /** Why the booking form cannot be submitted right now, if it cannot. */
  protected readonly bookingProblem = computed<BookingRefusal | null>(() => {
    this.formChanged();
    const value = this.bookingForm.getRawValue();
    // An untouched form is not wrong yet: showing "choose a patient" before the
    // secretary has typed anything would be nagging rather than helping.
    if (!value.patientId && !value.doctorId && !value.date) return null;
    return this.session.bookingRefusal(this.bookingDraft());
  });

  protected readonly bookingRefusalText = computed(() => {
    const problem = this.bookingProblem();
    return problem ? REFUSAL_TEXT[problem] : null;
  });

  protected readonly canSubmitBooking = computed(() => {
    this.formChanged();
    return this.bookingForm.valid && !this.bookingProblem();
  });

  protected readonly rescheduleProblem = computed<BookingRefusal | null>(() => {
    this.formChanged();
    const appointment = this.rescheduleFor();
    if (!appointment) return null;
    const startsAt = this.combine(this.rescheduleForm.getRawValue());
    return this.session.bookingRefusal(
      {
        patientId: appointment.patientId,
        doctorId: appointment.doctorId,
        startsAt,
        durationMinutes: appointment.durationMinutes,
        reason: appointment.reason,
      },
      // The appointment being moved must not clash with its own current slot.
      appointment.id,
    );
  });

  protected readonly rescheduleRefusalText = computed(() => {
    const problem = this.rescheduleProblem();
    return problem ? REFUSAL_TEXT[problem] : null;
  });

  constructor() {
    this.bookingForm.valueChanges.subscribe(() => this.formChanged.update((n) => n + 1));
    this.rescheduleForm.valueChanges.subscribe(() => this.formChanged.update((n) => n + 1));
  }

  protected onStatusFilterChange(item: DropdownItem): void {
    this.statusFilter.set(item.id as StatusFilter);
  }

  protected onDoctorFilterChange(item: DropdownItem): void {
    this.doctorFilter.set(item.id);
  }

  protected patientName(appointment: Appointment): string {
    return this.session.patientName(appointment.patientId);
  }

  protected doctorName(appointment: Appointment): string {
    return this.session.doctorName(appointment.doctorId);
  }

  protected length(appointment: Appointment): string {
    return formatDuration(appointment.durationMinutes);
  }

  protected canAct(appointment: Appointment): boolean {
    return LIVE.includes(appointment.status);
  }

  protected submitBooking(): void {
    if (this.bookingForm.invalid) {
      this.bookingForm.markAllAsTouched();
      return;
    }

    const created = this.session.book(this.bookingDraft());
    if (!created) {
      // The store refuses on the same rules the form just displayed, so this
      // should be unreachable. Announcing rather than failing silently keeps a
      // disagreement between the two visible instead of mysterious.
      this.announce('That appointment could not be booked. Check the form for what changed.');
      return;
    }

    this.announce(
      `${this.session.patientName(created.patientId)} is booked with ${this.session.doctorName(created.doctorId)}.`,
      created,
    );
    this.bookingForm.reset({ time: '09:00', duration: 30, reason: '' });
  }

  protected openReschedule(appointment: Appointment): void {
    const startsAt = new Date(appointment.startsAt);
    this.rescheduleForm.setValue({
      date: `${startsAt.getFullYear()}-${String(startsAt.getMonth() + 1).padStart(2, '0')}-${String(startsAt.getDate()).padStart(2, '0')}`,
      time: `${String(startsAt.getHours()).padStart(2, '0')}:${String(startsAt.getMinutes()).padStart(2, '0')}`,
    });
    this.rescheduleFor.set(appointment);
  }

  protected closeReschedule(): void {
    this.rescheduleFor.set(null);
  }

  protected submitReschedule(): void {
    const appointment = this.rescheduleFor();
    if (!appointment || this.rescheduleForm.invalid) return;

    const moved = this.session.reschedule(
      appointment.id,
      this.combine(this.rescheduleForm.getRawValue()),
    );
    if (!moved) {
      this.announce('That time is not available. Pick another one.');
      return;
    }

    this.closeReschedule();
    this.announce(
      `${this.session.patientName(appointment.patientId)} is moved to the new time.`,
      appointment,
    );
  }

  protected requestCancel(appointment: Appointment): void {
    this.confirmCancelFor.set(appointment);
  }

  protected cancelCancel(): void {
    this.confirmCancelFor.set(null);
  }

  protected confirmCancel(): void {
    const appointment = this.confirmCancelFor();
    if (!appointment) return;
    this.session.cancel(appointment.id);
    this.confirmCancelFor.set(null);
    this.announce(`${this.patientName(appointment)}'s appointment is cancelled.`, appointment);
  }

  /** The booking form's values as the store wants them. */
  private bookingDraft(): BookingDraft {
    const value = this.bookingForm.getRawValue();
    return {
      patientId: value.patientId,
      doctorId: value.doctorId,
      startsAt: this.combine(value),
      durationMinutes: value.duration,
      reason: value.reason,
    };
  }

  /**
   * A `YYYY-MM-DD` date input and a `HH:MM` time input into one timestamp.
   *
   * Built with `new Date(...)` and re-read locally rather than string-concatenated
   * into the stored format, so an impossible combination cannot be produced by
   * the inputs and the value handed to the store is always a real local time.
   * An incomplete pair yields an empty string, which the store refuses.
   */
  private combine(value: { date: string; time: string }): string {
    if (!value.date || !value.time) return '';
    const parsed = new Date(`${value.date}T${value.time}:00`);
    if (Number.isNaN(parsed.getTime())) return '';
    return localIso(parsed);
  }

  private announce(text: string, appointment?: Appointment): void {
    this.notice.set({ text, at: appointment?.startsAt });
  }

  // --- Field-level messages, shown only once the field has been touched.

  protected patientError(): string | null {
    const control = this.bookingForm.controls.patientId;
    return control.touched && control.invalid ? 'Choose the patient.' : null;
  }

  protected doctorError(): string | null {
    const control = this.bookingForm.controls.doctorId;
    return control.touched && control.invalid ? 'Choose a doctor.' : null;
  }

  protected dateError(): string | null {
    const control = this.bookingForm.controls.date;
    return control.touched && control.invalid ? 'Choose the day.' : null;
  }

  protected reasonError(): string | null {
    const control = this.bookingForm.controls.reason;
    if (!control.touched || control.valid) return null;
    if (control.hasError('required')) return 'Say what the visit is for.';
    if (control.hasError('minlength')) return 'Use at least 3 characters.';
    return null;
  }
}
