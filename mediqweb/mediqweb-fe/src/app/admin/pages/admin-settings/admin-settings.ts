import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button, Card, Dropdown, FormField, type DropdownItem } from '../../../shared/components';
import { ToastService } from '../../../core/services/toast.service';
import { HttpAdminGateway } from '../../../core/api/http-admin-gateway';

/** A configurable clinic preference. */
interface Choice {
  id: string;
  label: string;
}

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
 * Reads from and writes to the `clinic_settings` table in Supabase via the
 * admin gateway. Saving persists changes to the cloud database.
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
  private readonly toasts = inject(ToastService);
  private readonly gateway = inject(HttpAdminGateway);

  protected readonly sessionTimeouts = SESSION_TIMEOUTS;
  protected readonly retentionPeriods = RETENTION_PERIODS;

  protected readonly form = this.fb.nonNullable.group({
    clinicName: ['MediQ Clinic', [Validators.required, Validators.maxLength(80)]],
    address: ['12 Katipunan Avenue, Quezon City', [Validators.required]],
    contactEmail: ['hello@mediq.ph', [Validators.required, Validators.email]],
    contactNumber: ['+63 2 8555 0100', [Validators.required]],
    sessionTimeout: ['30'],
    retentionPeriod: ['1095'],
  });

  protected saving$ = false;

  constructor() {
    this.gateway.getSettings().subscribe({
      next: (settings) => {
        this.form.patchValue({
          clinicName: settings.clinic_name ?? 'MediQ Clinic',
          address: settings.address ?? '',
          contactEmail: settings.contact_email ?? '',
          contactNumber: settings.contact_number ?? '',
          sessionTimeout: String(settings.session_timeout_minutes ?? 30),
          retentionPeriod: String(settings.retention_period_days ?? 1095),
        });
      },
      error: () => {
        // Leave defaults; toast will appear on save attempt.
      },
    });
  }

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
  }

  protected selectedOf(control: keyof AdminSettings['form']['controls']): string {
    return this.form.controls[control].value;
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.toasts.warning('Nothing saved', 'Fix the highlighted fields, then save again.');
      return;
    }

    this.saving$ = true;
    const {
      clinicName,
      address,
      contactEmail,
      contactNumber,
      sessionTimeout,
      retentionPeriod,
    } = this.form.getRawValue();

    this.gateway
      .updateSettings({
        clinic_name: clinicName,
        address: address,
        contact_email: contactEmail,
        contact_number: contactNumber,
        session_timeout_minutes: Number(sessionTimeout),
        retention_period_days: Number(retentionPeriod),
      })
      .subscribe({
        next: () => {
          this.saving$ = false;
          this.toasts.success('Settings saved', 'Clinic settings have been updated.');
        },
        error: (err) => {
          this.saving$ = false;
          this.toasts.error('Save failed', err.message ?? 'Could not save settings.');
        },
      });
  }
}
