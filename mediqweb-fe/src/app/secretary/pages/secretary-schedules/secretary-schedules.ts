import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  Avatar,
  Button,
  Card,
  MockNotice,
  StatusBadge,
  type BadgeTone,
} from '../../../shared/components';
import { DAY_NAMES, formatDuration } from '../../secretary.dates';
import { SecretarySession } from '../../secretary-session';
import type { DoctorSummary, ScheduleDay } from '../../secretary.models';

/**
 * Every doctor's published week, side by side.
 *
 * A Secretary's real question is "who is free on Thursday?", which a per-doctor
 * page answers one doctor at a time. Laying the weeks out together turns the
 * question into a single glance down a column, which is why this is one page for
 * all doctors rather than `/doctors/:id/schedule`.
 *
 * Read-only on purpose: a doctor publishes their own hours from the Doctor area,
 * and a Secretary editing them would make the published week depend on who last
 * touched the booking screen. Changing a doctor's availability is the Doctor's
 * action; an Administrator can still take a doctor off the roster entirely.
 */
@Component({
  selector: 'app-secretary-schedules',
  imports: [Avatar, Button, Card, MockNotice, StatusBadge],
  templateUrl: './secretary-schedules.html',
  styleUrl: './secretary-schedules.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretarySchedules {
  private readonly session = inject(SecretarySession);

  protected readonly dayNames = DAY_NAMES;

  /** Filters the weeks to one doctor when set; otherwise shows every doctor. */
  protected readonly selectedDoctorId = signal<string | null>(null);

  protected readonly doctors = computed<DoctorSummary[]>(() => {
    const selected = this.selectedDoctorId();
    const all = this.session.doctors();
    return selected ? all.filter((summary) => summary.doctor.id === selected) : all;
  });

  /** A doctor's week, sorted Sunday-first, ready for the grid. */
  protected daysFor(summary: DoctorSummary): ScheduleDay[] {
    return this.session.scheduleFor(summary.doctor.id);
  }

  protected isEnabled(day: ScheduleDay): boolean {
    return day.enabled;
  }

  /** `09:00 – 12:00`, or an em dash for a closed day. */
  protected window(day: ScheduleDay): string {
    if (!day.enabled) return '—';
    return `${day.startTime} – ${day.endTime}`;
  }

  /** The summary line above each doctor's week. */
  protected publishedFor(summary: DoctorSummary): string {
    const days = this.daysFor(summary);
    const open = days.filter((day) => day.enabled).length;
    const minutes = this.session.weeklyMinutes(summary.doctor.id);
    if (!open) return 'Not publishing any hours';

    return `${open} ${open === 1 ? 'day' : 'days'} · ${formatDuration(minutes)} a week`;
  }

  protected statusTone(summary: DoctorSummary): BadgeTone {
    return summary.doctor.status === 'active' ? 'success' : 'neutral';
  }

  protected selectDoctor(id: string | null): void {
    // Toggling the active doctor clears the filter, so the same control reads as
    // "show one" and "show all again" rather than needing a separate button.
    this.selectedDoctorId.update((current) => (current === id ? null : id));
  }

  protected isSelected(id: string): boolean {
    return this.selectedDoctorId() === id;
  }

  protected reset(): void {
    this.selectedDoctorId.set(null);
  }

  /** Appointments this doctor has left to come, for the "how busy" footnote. */
  protected bookedFor(summary: DoctorSummary): number {
    const now = this.session.now().getTime();
    return this.session
      .appointmentsForDoctor(summary.doctor.id)
      .filter(
        (appointment) =>
          (appointment.status === 'booked' || appointment.status === 'confirmed') &&
          new Date(appointment.startsAt).getTime() >= now,
      ).length;
  }
}
