import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Avatar,
  Card,
  MockNotice,
  StatusBadge,
  Table,
  TableCell,
  type BadgeTone,
  type TableColumn,
} from '../../../shared/components';
import type { AccountStatus } from '../../../shared/domain/account-status';
import { SecretarySession } from '../../secretary-session';
import type { DoctorSummary } from '../../secretary.models';

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
 * The doctor this Secretary is assigned to.
 *
 * The columns are the questions the desk asks about the one doctor on it: who is
 * this, when are they in, when can I book them, and are they taking patients at
 * all. Availability is summarised rather than laid out in full because the week
 * itself has its own page — a table of seven columns would be unreadable at this
 * width.
 *
 * This used to be the clinic's whole roster, searchable and filtered by account
 * status, and both controls are gone rather than left doing nothing: there is one
 * row, so a search box that can only find what is already on screen and a filter
 * that can only hide it are both noise around the fact itself.
 */
@Component({
  selector: 'app-secretary-doctors',
  imports: [DatePipe, RouterLink, Avatar, Card, MockNotice, StatusBadge, Table, TableCell],
  templateUrl: './secretary-doctors.html',
  styleUrl: './secretary-doctors.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretaryDoctors {
  private readonly session = inject(SecretarySession);

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

  protected readonly rows = computed<DoctorRow[]>(() =>
    this.session.doctors().map((summary): DoctorRow => {
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
    }),
  );

  protected readonly totalCount = computed(() => this.session.doctors().length);

  protected readonly unassignedMessage = this.session.unassignedMessage;

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

  protected statusTone(status: AccountStatus): BadgeTone {
    return status === 'active' ? 'success' : 'neutral';
  }
}
