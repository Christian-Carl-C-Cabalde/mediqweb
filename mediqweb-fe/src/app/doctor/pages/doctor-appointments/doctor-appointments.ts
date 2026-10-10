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
import { ToastService } from '../../../core/services/toast.service';
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
  private readonly toasts = inject(ToastService);

  protected readonly query = signal('');
  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly confirmCancelFor = signal<Appointment | null>(null);

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
    this.report(
      appointment,
      'confirmed',
      'Appointment confirmed',
      (name) => `${name} is expected.`,
    );
  }

  protected complete(appointment: Appointment): void {
    this.report(
      appointment,
      'completed',
      'Visit recorded',
      (name) => `${name} is marked complete.`,
    );
  }

  protected markNoShow(appointment: Appointment): void {
    // A warning rather than a success: the recording worked, but it is bad news
    // about the appointment and reads as a neutral "done" otherwise.
    this.report(
      appointment,
      'no-show',
      'Recorded as a no-show',
      (name) => `${name} did not attend.`,
      'warning',
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
    const changed = this.session.setAppointmentStatus(appointment.id, 'cancelled');
    this.confirmCancelFor.set(null);

    if (changed) {
      this.toasts.warning(
        'Appointment cancelled',
        `${this.patientName(appointment)} will not be seen.`,
      );
    } else {
      this.toasts.error('Not cancelled', 'That appointment could not be updated.');
    }
  }

  /**
   * Moves an appointment along and reports what actually happened.
   *
   * One place for the four status changes, because they differ only in their
   * wording and they must not differ in whether they check. A row whose status was
   * moved on by something else would otherwise be reported as recorded by this
   * click, which is the one thing the toast is not allowed to get wrong.
   */
  private report(
    appointment: Appointment,
    status: AppointmentStatus,
    title: string,
    sentence: (name: string) => string,
    tone: 'success' | 'warning' = 'success',
  ): void {
    const name = this.patientName(appointment);
    if (!this.session.setAppointmentStatus(appointment.id, status)) {
      this.toasts.error('Not updated', `${name}'s appointment is no longer in a state to change.`);
      return;
    }
    this.toasts.show(tone, title, sentence(name));
  }
}
