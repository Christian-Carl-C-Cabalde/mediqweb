import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { StatusBadge, type BadgeTone } from '../../../shared/components';
import type { AppointmentStatus } from '../../doctor.models';

/**
 * Status -> badge tone, as a `Record` rather than an object literal so a new
 * status is a compile error here instead of an `undefined` tone at runtime.
 *
 * `booked` reads as information rather than a warning: not confirming an
 * appointment is a normal state, not a failure.
 */
const STATUS_TONE: Record<AppointmentStatus, BadgeTone> = {
  booked: 'info',
  confirmed: 'primary',
  completed: 'success',
  cancelled: 'neutral',
  'no-show': 'warning',
};

/**
 * One place that decides how an appointment status looks.
 *
 * The dashboard, the appointments table and the patient history all show the
 * same statuses, so the tone map lives here rather than being restated per
 * page. Without it, a `no-show` would quietly be a different colour on each
 * screen.
 */
@Component({
  selector: 'doctor-appointment-status',
  imports: [StatusBadge],
  template: `
    <ui-status-badge [tone]="tone()" [dot]="true" size="sm">{{ status() }}</ui-status-badge>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentStatusBadge {
  readonly status = input.required<AppointmentStatus>();

  protected readonly tone = computed(() => STATUS_TONE[this.status()]);
}
