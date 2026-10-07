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
import type { AuditSeverity } from '../../admin.models';

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
 * The severity's name in prose. Same words the audit log page prints in its
 * severity column: a chart and the table it summarises must not disagree about
 * what a colour is called.
 */
const SEVERITY_LABEL: Record<AuditSeverity, string> = {
  info: 'Routine',
  warning: 'Needs attention',
  danger: 'Problem',
};

/**
 * The order slices appear in the chart and its legend. Fixed rather than
 * derived from the entries, so a legend does not reorder itself as data
 * changes, and in the same order the audit log offers its severities in.
 */
const SEVERITY_ORDER: readonly AuditSeverity[] = ['info', 'warning', 'danger'];

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
   * The activity list, counted by severity for the chart beside it.
   *
   * Counts are taken over the same capped list that is rendered, so the pie
   * and the rows it sits next to always total the same entries — a breakdown
   * of a wider window than the list would show a slice for something the
   * reader cannot then find in the list.
   */
  protected readonly severitySlices = computed<PieSlice[]>(() => {
    const counts: Record<AuditSeverity, number> = { info: 0, warning: 0, danger: 0 };
    for (const entry of this.activity()) {
      counts[entry.severity] += 1;
    }
    return SEVERITY_ORDER.filter((severity) => counts[severity] > 0).map((severity) => ({
      label: SEVERITY_LABEL[severity],
      value: counts[severity],
      color: BADGE_TONE_TOKEN[SEVERITY_TONE[severity]],
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
