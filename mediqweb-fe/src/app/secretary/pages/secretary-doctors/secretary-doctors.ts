import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Avatar,
  Card,
  Dropdown,
  FilterBar,
  MockNotice,
  StatusBadge,
  Table,
  TableCell,
  type BadgeTone,
  type DropdownItem,
  type TableColumn,
} from '../../../shared/components';
import type { AccountStatus } from '../../../shared/domain/account-status';
import { SecretarySession } from '../../secretary-session';
import type { DoctorSummary } from '../../secretary.models';

type StatusFilter = 'all' | AccountStatus;

const STATUS_ITEMS: DropdownItem[] = [
  { id: 'all', label: 'All accounts' },
  { id: 'active', label: 'Taking bookings' },
  { id: 'inactive', label: 'Not taking bookings' },
];

/**
 * A display row, flattened from `DoctorSummary`.
 *
 * `ui-table` sorts by comparing the raw value under a column key, so a column
 * holding a `Doctor` or a `ScheduleDay[]` would compare `"[object Object]"` with
 * itself and silently never reorder — a sortable header that looks broken.
 * Flattening to primitives makes every sortable column real.
 */
interface DoctorRow {
  readonly id: string;
  readonly name: string;
  readonly specialization: string;
  readonly email: string;
  readonly status: AccountStatus;
  /** e.g. "18h a week", or "Not taking bookings". */
  readonly weeklyHours: string;
  /** ISO timestamp of the next live appointment, or `null`. */
  readonly nextAvailableAt: string | null;
  readonly openDays: number;
  readonly appointmentCount: number;
}

/**
 * The clinic's doctors, as the desk needs to see them.
 *
 * The columns are the questions the desk actually asks: who is this, when are
 * they in, when can I book them, and are they taking patients at all. Availability
 * is summarised rather than laid out in full because the week itself has its own
 * page — a table of seven columns per doctor would be unreadable at this width.
 */
@Component({
  selector: 'app-secretary-doctors',
  imports: [
    DatePipe,
    RouterLink,
    Avatar,
    Card,
    Dropdown,
    FilterBar,
    MockNotice,
    StatusBadge,
    Table,
    TableCell,
  ],
  templateUrl: './secretary-doctors.html',
  styleUrl: './secretary-doctors.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretaryDoctors {
  private readonly session = inject(SecretarySession);

  protected readonly query = signal('');
  protected readonly statusFilter = signal<StatusFilter>('all');

  protected readonly statusOptions = STATUS_ITEMS;

  protected readonly columns: TableColumn<DoctorRow>[] = [
    { key: 'name', header: 'Doctor', sortable: true },
    { key: 'specialization', header: 'Specialization', hideBelow: 'md' },
    { key: 'weeklyHours', header: 'Published', sortable: true },
    { key: 'openDays', header: 'Days', sortable: true, align: 'end' },
    { key: 'appointmentCount', header: 'Booked', sortable: true, align: 'end' },
    { key: 'nextAvailableAt', header: 'Next appointment', sortable: true },
    { key: 'status', header: 'Account', sortable: true },
    { key: 'actions', header: 'Actions', align: 'end' },
  ];

  protected readonly rows = computed<DoctorRow[]>(() => {
    const term = this.query().trim().toLowerCase();
    const status = this.statusFilter();

    return this.session
      .doctors()
      .filter((summary) => {
        if (status !== 'all' && summary.doctor.status !== status) return false;
        if (!term) return true;
        return (
          summary.doctor.name.toLowerCase().includes(term) ||
          summary.doctor.specialization.toLowerCase().includes(term) ||
          summary.doctor.email.toLowerCase().includes(term)
        );
      })
      .map((summary): DoctorRow => {
        const days = this.session.scheduleFor(summary.doctor.id);
        return {
          id: summary.doctor.id,
          name: summary.doctor.name,
          specialization: summary.doctor.specialization,
          email: summary.doctor.email,
          status: summary.doctor.status,
          weeklyHours: summary.weeklyHours,
          nextAvailableAt: summary.nextAvailable,
          openDays: days.filter((day) => day.enabled).length,
          appointmentCount: this.liveCount(summary.doctor.id),
        };
      });
  });

  protected readonly totalCount = computed(() => this.session.doctors().length);

  /** Live appointments — booked or confirmed, ignoring what is already over. */
  private liveCount(doctorId: string): number {
    const now = this.session.now().getTime();
    return this.session
      .appointmentsForDoctor(doctorId)
      .filter(
        (appointment) =>
          (appointment.status === 'booked' || appointment.status === 'confirmed') &&
          new Date(appointment.startsAt).getTime() >= now,
      ).length;
  }

  protected onStatusFilterChange(item: DropdownItem): void {
    this.statusFilter.set(item.id as StatusFilter);
  }

  protected statusTone(status: AccountStatus): BadgeTone {
    return status === 'active' ? 'success' : 'neutral';
  }
}
