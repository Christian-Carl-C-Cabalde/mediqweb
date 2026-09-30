import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  AppointmentStatusBadge,
  Avatar,
  Card,
  MockNotice,
  StatCard,
} from '../../../shared/components';
import { SecretarySession } from '../../secretary-session';
import type { Appointment, DoctorSummary } from '../../secretary.models';

/**
 * Landing page for the Secretary area.
 *
 * Answers the three questions a secretary has on arrival: what is happening
 * today, who can still be booked, and what is outstanding. The counts come from
 * the mock session, so they move as appointments are booked and cancelled
 * elsewhere in the area.
 *
 * The booking action is a link rather than a form on this page: booking needs a
 * patient, a doctor, a time and a reason, which is a screen of its own. Opening
 * the list with the form ready is one click and no lost context.
 */
@Component({
  selector: 'app-secretary-dashboard',
  imports: [DatePipe, RouterLink, AppointmentStatusBadge, Avatar, Card, MockNotice, StatCard],
  templateUrl: './secretary-dashboard.html',
  styleUrl: './secretary-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretaryDashboard {
  private readonly session = inject(SecretarySession);

  protected readonly todayCount = computed(() => this.session.todaysAppointments().length);

  protected readonly awaitingCount = computed(() => this.session.awaitingConfirmation().length);

  protected readonly patientCount = computed(() => this.session.patients().length);

  protected readonly doctorCount = computed(() => this.session.activeDoctorCount());

  protected readonly today = computed(() => this.session.todaysAppointments());

  protected readonly next = computed(() => this.session.nextAppointment());

  /**
   * Doctors who can still be booked today, busiest-last.
   *
   * Only active doctors, because an inactive one is not somewhere a patient can
   * be sent. Ordered by how much of today they have left so the list answers
   * "who has room?" rather than presenting a directory.
   */
  protected readonly availableDoctors = computed<DoctorSummary[]>(() =>
    this.session
      .doctors()
      .filter((summary) => summary.doctor.status === 'active')
      .sort((a, b) => this.remainingToday(a) - this.remainingToday(b))
      .slice(0, 5),
  );

  /**
   * Appointments still to come today for a doctor.
   *
   * A method rather than a `computed` because it is only ever called from inside
   * `availableDoctors`, and a `computed` per doctor would need its own signal to
   * invalidate on.
   */
  private remainingToday(summary: DoctorSummary): number {
    const now = this.session.now().getTime();
    return this.session
      .appointmentsForDoctor(summary.doctor.id)
      .filter(
        (appointment) =>
          (appointment.status === 'booked' || appointment.status === 'confirmed') &&
          new Date(appointment.startsAt).getTime() >= now &&
          new Date(appointment.startsAt).toDateString() === new Date(now).toDateString(),
      ).length;
  }

  protected bookedToday(summary: DoctorSummary): number {
    return this.remainingToday(summary);
  }

  protected patientName(appointment: Appointment): string {
    return this.session.patientName(appointment.patientId);
  }

  protected doctorName(appointment: Appointment): string {
    return this.session.doctorName(appointment.doctorId);
  }
}
