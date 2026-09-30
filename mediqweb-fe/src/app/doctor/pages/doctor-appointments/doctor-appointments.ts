import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AppointmentStatusBadge,
  Avatar,
  Button,
  Card,
  Dropdown,
  FilterBar,
  MockNotice,
  Modal,
  Table,
  TableCell,
  type DropdownItem,
  type TableColumn,
} from '../../../shared/components';
import { formatDuration } from '../../doctor.dates';
import { DoctorSession } from '../../doctor-session';
import type { Appointment, AppointmentStatus } from '../../doctor.models';

type StatusFilter = 'all' | AppointmentStatus;

const STATUS_ITEMS: DropdownItem[] = [
  { id: 'all', label: 'All statuses' },
  { id: 'booked', label: 'Booked' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'no-show', label: 'No-show' },
];

/** Cancelling is destructive, so it is the only action that asks first. */
const CANCELLABLE: readonly AppointmentStatus[] = ['booked', 'confirmed'];

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
 * The doctor's appointment list.
 *
 * Reading and moving appointments along their lifecycle: confirm a booking,
 * close it after the consultation, or record a no-show. Creating and
 * rescheduling are absent on purpose — a Secretary at the front desk owns the
 * diary, and inventing a booking form here would put two sources of truth on
 * the same schedule.
 */
@Component({
  selector: 'app-doctor-appointments',
  imports: [
    DatePipe,
    RouterLink,
    Avatar,
    Button,
    Card,
    Dropdown,
    FilterBar,
    MockNotice,
    Modal,
    Table,
    TableCell,
    AppointmentStatusBadge,
  ],
  templateUrl: './doctor-appointments.html',
  styleUrl: './doctor-appointments.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorAppointments {
  private readonly session = inject(DoctorSession);

  protected readonly query = signal('');
  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly confirmCancelFor = signal<Appointment | null>(null);
  protected readonly notice = signal<Notice | null>(null);

  protected readonly statusOptions = STATUS_ITEMS;

  protected readonly columns: TableColumn<Appointment>[] = [
    { key: 'startsAt', header: 'When', sortable: true },
    { key: 'patientId', header: 'Patient' },
    { key: 'reason', header: 'Reason', hideBelow: 'md' },
    { key: 'durationMinutes', header: 'Length', hideBelow: 'lg' },
    { key: 'status', header: 'Status', sortable: true },
    { key: 'actions', header: 'Actions', align: 'end' },
  ];

  protected readonly appointments = computed(() => {
    const term = this.query().trim().toLowerCase();
    const status = this.statusFilter();
    return this.session.appointments().filter((appointment) => {
      if (status !== 'all' && appointment.status !== status) return false;
      if (!term) return true;
      // Search by the patient's name as well as the reason, otherwise typing
      // "Juan" finds nothing and the box looks broken.
      return (
        this.session.patientName(appointment.patientId).toLowerCase().includes(term) ||
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

  protected onStatusFilterChange(item: DropdownItem): void {
    this.statusFilter.set(item.id as StatusFilter);
  }

  protected patientName(appointment: Appointment): string {
    return this.session.patientName(appointment.patientId);
  }

  protected length(appointment: Appointment): string {
    return formatDuration(appointment.durationMinutes);
  }

  protected canCancel(appointment: Appointment): boolean {
    return CANCELLABLE.includes(appointment.status);
  }

  protected confirm(appointment: Appointment): void {
    this.session.setAppointmentStatus(appointment.id, 'confirmed');
    this.announce(`${this.patientName(appointment)} is confirmed.`, appointment);
  }

  protected complete(appointment: Appointment): void {
    this.session.setAppointmentStatus(appointment.id, 'completed');
    this.announce(`${this.patientName(appointment)} is marked complete.`, appointment);
  }

  protected markNoShow(appointment: Appointment): void {
    this.session.setAppointmentStatus(appointment.id, 'no-show');
    this.announce(`${this.patientName(appointment)} is recorded as a no-show.`, appointment);
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
    this.session.setAppointmentStatus(appointment.id, 'cancelled');
    this.confirmCancelFor.set(null);
    this.announce(`${this.patientName(appointment)}'s appointment is cancelled.`, appointment);
  }

  private announce(text: string, appointment: Appointment): void {
    this.notice.set({ text, at: appointment.startsAt });
  }
}
