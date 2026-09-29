import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button, Card, FormField, MockNotice } from '../../../shared/components';
import { DetailList } from '../../components/detail-list/detail-list';
import { DoctorSession } from '../../doctor-session';

/**
 * The doctor's own profile.
 *
 * Split into a read-only summary of the fields the Admin owns — specialization
 * and licence number — and an editable set the doctor controls. A doctor who
 * could edit their own licence number could also edit their own credentials,
 * so those two fields are not on the form and are not marked disabled: they are
 * simply not there.
 *
 * Saving writes to the mock store, which the header reads, so the name in the
 * top right updates. Nothing is persisted, and the notice says so.
 */
@Component({
  selector: 'app-doctor-profile',
  imports: [DatePipe, ReactiveFormsModule, Button, Card, FormField, MockNotice, DetailList],
  templateUrl: './doctor-profile.html',
  styleUrl: './doctor-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorProfilePage {
  private readonly session = inject(DoctorSession);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly notice = signal<string | null>(null);

  protected readonly profile = this.session.profile;

  /** How many patients the header should imply the doctor looks after. */
  protected readonly patientCount = computed(() => this.session.patients().length);

  protected readonly form = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.minLength(2)]),
    email: this.fb.control('', [Validators.required, Validators.email]),
    phone: this.fb.control('', [Validators.required]),
    bio: this.fb.control('', [Validators.maxLength(280)]),
  });

  constructor() {
    this.resetForm();
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.notice.set('Fix the highlighted fields before saving.');
      return;
    }

    this.session.updateProfile(this.form.getRawValue());
    this.notice.set('Saved in this session only. Reload the page and the old details return.');
  }

  protected resetForm(): void {
    const { name, email, phone, bio } = this.session.profile();
    this.form.setValue({ name, email, phone, bio });
    this.form.markAsPristine();
    this.form.markAsUntouched();
    this.notice.set(null);
  }

  protected nameError(): string | null {
    const control = this.form.controls.name;
    if (!control.touched) return null;
    if (control.hasError('required')) return 'Enter the name patients should see.';
    if (control.hasError('minlength')) return 'Use at least 2 characters.';
    return null;
  }

  protected emailError(): string | null {
    const control = this.form.controls.email;
    if (!control.touched) return null;
    if (control.hasError('required')) return 'Enter an email address.';
    if (control.hasError('email')) return 'Enter a valid email address, e.g. name@clinic.ph';
    return null;
  }

  protected phoneError(): string | null {
    const control = this.form.controls.phone;
    return control.touched && control.hasError('required') ? 'Enter a contact number.' : null;
  }

  protected bioError(): string | null {
    const control = this.form.controls.bio;
    return control.touched && control.hasError('maxlength')
      ? `Keep the introduction to 280 characters or fewer (${control.value.length} now).`
      : null;
  }
}
