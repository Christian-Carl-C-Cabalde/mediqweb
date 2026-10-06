import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import {
  Card,
  MockNotice,
  StatCard,
  BADGE_TONE_TOKEN,
  type BadgeTone,
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
 * Landing page for the Admin area.
 *
 * Counts and activity come from the mock session, so the numbers move as
 * accounts are added or disabled elsewhere in the area.
 */
@Component({
  selector: 'app-admin-dashboard',
  imports: [DatePipe, RouterLink, Card, StatCard, MockNotice],
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
