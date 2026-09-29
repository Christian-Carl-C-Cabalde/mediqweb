import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button, Card, Dropdown, FormField, type DropdownItem } from '../../../shared/components';

/** A configurable clinic preference. */
interface Choice {
  id: string;
  label: string;
}

const SLOT_LENGTHS: Choice[] = [
  { id: '15', label: '15 minutes' },
  { id: '20', label: '20 minutes' },
  { id: '30', label: '30 minutes' },
  { id: '45', label: '45 minutes' },
  { id: '60', label: '60 minutes' },
];

const BOOKING_WINDOWS: Choice[] = [
  { id: '7', label: '1 week ahead' },
  { id: '14', label: '2 weeks ahead' },
  { id: '30', label: '1 month ahead' },
  { id: '90', label: '3 months ahead' },
];

const REMINDER_LEAD_TIMES: Choice[] = [
  { id: '0', label: 'At the time of booking' },
  { id: '2', label: '2 hours before' },
  { id: '24', label: '1 day before' },
  { id: '48', label: '2 days before' },
];

const SESSION_TIMEOUTS: Choice[] = [
  { id: '15', label: '15 minutes' },
  { id: '30', label: '30 minutes' },
  { id: '60', label: '1 hour' },
  { id: '240', label: '4 hours' },
];

const RETENTION_PERIODS: Choice[] = [
  { id: '365', label: '1 year' },
  { id: '1095', label: '3 years' },
  { id: '1825', label: '5 years' },
  { id: '0', label: 'Keep indefinitely' },
];

/**
 * Clinic-wide settings.
 *
 * Every control is a real form control with real validation, so the page can be
 * reviewed as a genuine form. Saving deliberately reports that nothing was
 * persisted — there is nowhere to persist it yet, and a settings page that
 * silently forgets your changes is worse than one that says so.
 *
 * Preferences are all enumerations or text. Nothing here is a boolean toggle:
 * the design system has no switch component, and inventing one on this page
 * would leave a page-local widget that later pages would duplicate. A
 * `ui-switch` belongs in the shared library when the first page genuinely needs
 * one.
 */
@Component({
  selector: 'app-admin-settings',
  imports: [ReactiveFormsModule, Button, Card, Dropdown, FormField],
  templateUrl: './admin-settings.html',
  styleUrl: './admin-settings.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettings {
  private readonly fb = inject(FormBuilder);

  protected readonly slotLengths = SLOT_LENGTHS;
  protected readonly bookingWindows = BOOKING_WINDOWS;
  protected readonly reminderLeadTimes = REMINDER_LEAD_TIMES;
  protected readonly sessionTimeouts = SESSION_TIMEOUTS;
  protected readonly retentionPeriods = RETENTION_PERIODS;

  protected readonly notice = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    clinicName: ['MediQ Clinic', [Validators.required, Validators.maxLength(80)]],
    address: ['12 Katipunan Avenue, Quezon City', [Validators.required]],
    contactEmail: ['hello@mediq.ph', [Validators.required, Validators.email]],
    contactNumber: ['+63 2 8555 0100', [Validators.required]],
    slotLength: ['30'],
    bookingWindow: ['30'],
    reminderLeadTime: ['24'],
    sessionTimeout: ['30'],
    retentionPeriod: ['1095'],
  });

  protected errorFor(
    control: 'clinicName' | 'address' | 'contactEmail' | 'contactNumber',
  ): string | null {
    const field = this.form.controls[control];
    if (!field.touched) return null;
    if (field.hasError('required')) return 'This field is required.';
    if (field.hasError('email')) return 'Enter a valid email address.';
    if (field.hasError('maxlength')) return 'This is too long.';
    return null;
  }

  /** Applies a dropdown selection to its form control. */
  protected pick(control: keyof AdminSettings['form']['controls'], item: DropdownItem): void {
    this.form.controls[control].setValue(item.id);
    this.notice.set(null);
  }

  protected selectedOf(control: keyof AdminSettings['form']['controls']): string {
    return this.form.controls[control].value;
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notice.set('Fix the highlighted fields before saving.');
      return;
    }
    // No service to call yet. Say so rather than pretending the save worked.
    this.notice.set('Settings are not connected yet, so nothing was saved.');
  }
}
