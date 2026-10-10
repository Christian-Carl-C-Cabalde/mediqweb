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
import type { Appointment, AppointmentStatus, VisitOutcome } from '../../doctor.models';

type StatusFilter = 'all' | AppointmentStatus;

const STATUS_ITEMS: DropdownItem[] = [
  { id: 'all', label: 'All statuses' },
  { id: 'booked', label: 'Booked' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
  { id: 'no-show', label: 'No-show' },
];

/**
 * The doctor's appointment list.
 *
 * Reading the diary and recording what happened at it. Two actions, and the page
 * is built around how few they are: mark a visit **complete**, or record a
 * **no-show** for a patient who was not there in the booked time. Both say what
 * occurred, and neither is available until the appointment has been confirmed —
 * because the front desk confirms first, and a doctor recording an outcome on a
 * booking nobody approved would skip that step rather than describe anything.
 *
 * Everything else in the lifecycle is absent on purpose, and it is the store that
 * refuses it rather than the template that hides it. A doctor cannot approve their
 * own booking — that is the Secretary's, and it means the patient said they were
 * coming — cannot cancel one, which is an administrative decision about a booking
 * rather than a record of a consultation, and cannot create or move one. See
 * `DoctorSession.recordOutcome`, which is the only lever the store offers.
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

  /**
   * Whether an outcome can be recorded against this appointment.
   *
   * Mirrors the store's rule rather than restating it in the template, and says
   * the same thing the store does: only an appointment the front desk has
   * confirmed has had a visit to describe. A `booked` row shows no action at all,
   * which is the honest answer — there is nothing yet to report about it.
   */
  protected canRecord(appointment: Appointment): boolean {
    return appointment.status === 'confirmed';
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

  /**
   * Records an outcome and reports what actually happened.
   *
   * One place for the two, because they differ only in their wording and they must
   * not differ in whether they check. A row whose status had already moved on —
   * by another session, or by a second click — would otherwise be reported as
   * recorded by this one, which is the single thing the toast is not allowed to
   * get wrong.
   */
  private report(
    appointment: Appointment,
    outcome: VisitOutcome,
    title: string,
    sentence: (name: string) => string,
    tone: 'success' | 'warning' = 'success',
  ): void {
    const name = this.patientName(appointment);
    if (!this.session.recordOutcome(appointment.id, outcome)) {
      this.toasts.error('Not recorded', `${name}'s appointment is no longer one you can close.`);
      return;
    }
    this.toasts.show(tone, title, sentence(name));
  }
}
