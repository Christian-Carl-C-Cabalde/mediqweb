import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Card,
  MockNotice,
  PieChart,
  StatCard,
  BADGE_TONE_TOKEN,
  type BadgeTone,
  type PieSlice,
} from '../../../shared/components';
import { AdminSession } from '../../admin-session';
import type { AppointmentStatus, AuditSeverity } from '../../admin.models';

/**
 * Severity and badge tone are the same set, so one map serves both. Declared
 * `Record<AuditSeverity, BadgeTone>` rather than as an object literal so adding
 * a severity is a compile error here instead of an `undefined` at runtime.
 */
const SEVERITY_TONE: Record<AuditSeverity, BadgeTone> = {
  info: 'info',
  warning: 'warning',
  danger: 'danger',
};

/**
 * The three states the chart shows, in the order they appear in its legend,
 * each with the tone it is drawn in.
 *
 * Each is a stage an appointment passes through: `booked` is waiting for the
 * clinic to confirm it, `confirmed` is the one the patient is expected to turn
 * up for, `completed` is the one they did. `cancelled` and `no-show` are
 * outcomes rather than stages, so they are not counted here — the chart is a
 * picture of work in flight, and a chart that folded a no-show into "finished"
 * would be reporting an appointment that happened when it did not.
 *
 * The three colours read as a progress line rather than as severity, which is
 * why they are chosen here instead of taken from the status badge's table: on a
 * badge, `booked` is quiet because it is unremarkable, but on this chart a
 * `booked` appointment is the one nobody has acted on yet, and red is what
 * says so. Reading left to right the chart runs red -> blue -> green, the
 * direction the work moves in.
 */
const LIFECYCLE: readonly { label: string; status: AppointmentStatus; tone: BadgeTone }[] = [
  { label: 'Pending', status: 'booked', tone: 'danger' },
  { label: 'Ongoing', status: 'confirmed', tone: 'info' },
  { label: 'Finished', status: 'completed', tone: 'success' },
];

/**
 * Landing page for the Admin area.
 *
 * Counts and activity come from the mock session, so the numbers move as
 * accounts are added or disabled elsewhere in the area.
 */
@Component({
  selector: 'app-admin-dashboard',
  imports: [DatePipe, RouterLink, Card, StatCard, PieChart, MockNotice],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboard {
  private readonly session = inject(AdminSession);

  protected readonly doctors = computed(() => this.session.activeDoctorCount());
  protected readonly secretaries = computed(() => this.session.activeSecretaryCount());
  protected readonly patients = computed(() => this.session.activePatientCount());
  protected readonly specializations = computed(() => this.session.specializations().length);

  protected readonly activity = computed(() => this.session.recentActivity());

  /**
   * The clinic's appointments, counted into the three stages the chart shows.
   *
   * Counted from the whole fixture rather than a window of it: unlike the
   * activity list beside it, "how much work is finished" is not a claim about
   * the last few entries, it is a claim about everything, so filtering to a
   * recent slice would understate the Finished count for no reason.
   *
   * Tone names resolve through the badge's own token table, so a slice is
   * painted by the same tokens the design system already uses rather than by
   * colour literals typed in here.
   */
  protected readonly lifecycleSlices = computed<PieSlice[]>(() => {
    const appointments = this.session.appointments();
    return LIFECYCLE.map(({ label, status, tone }) => ({
      label,
      value: appointments.filter((appointment) => appointment.status === status).length,
      color: BADGE_TONE_TOKEN[tone],
    }));
  });

  protected severityTone(severity: AuditSeverity): BadgeTone {
    return SEVERITY_TONE[severity];
  }

  /**
   * The colour for the severity dot.
   *
   * Goes through `severityTone` and then the badge's own tone table, rather than
   * mapping severity to a colour here, so there is one path from severity to
   * colour and a dot cannot drift away from a badge of the same severity.
   */
  protected severityToken(severity: AuditSeverity): string {
    return BADGE_TONE_TOKEN[this.severityTone(severity)];
  }
}
