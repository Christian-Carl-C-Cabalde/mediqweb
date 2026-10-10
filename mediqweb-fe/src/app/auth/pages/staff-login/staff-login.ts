import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import {
  Brand,
  Button,
  FormField,
  Modal,
  SampleAccounts,
  type SampleAccount,
} from '../../../shared/components';
import { AUTH_GATEWAY } from './auth.gateway';
import { emailOrUsername } from './staff-login.validators';
import { MOCK_STAFF_ACCOUNTS, MockAuthGateway } from './mock-auth.gateway';

/**
 * Staff sign-in for Admin, Doctor and Secretary.
 *
 * There is deliberately no registration path: staff accounts are created by an
 * Admin, so the only way in is an existing account. The "forgot password"
 * route therefore explains who to contact instead of pretending to email a
 * reset link.
 *
 * UI only. The page talks to the `AuthGateway` contract, never to HTTP.
 */
@Component({
  selector: 'app-staff-login',
  imports: [ReactiveFormsModule, Brand, Button, FormField, Modal, SampleAccounts],
  templateUrl: './staff-login.html',
  styleUrl: './staff-login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    // Swap for the real AuthService when the API branch lands.
    { provide: AUTH_GATEWAY, useClass: MockAuthGateway },
  ],
})
export class StaffLogin {
  private readonly fb = inject(FormBuilder);
  private readonly gateway = inject(AUTH_GATEWAY);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly authError = signal<string | null>(null);
  protected readonly passwordVisible = signal(false);
  protected readonly forgotPasswordOpen = signal(false);

  /**
   * The sample accounts, printed so sign-in can be walked without reading the
   * source. They are the same list the gateway checks, so the screen cannot
   * drift from what it accepts.
   */
  protected readonly sampleAccounts: readonly SampleAccount[] = MOCK_STAFF_ACCOUNTS;

  protected readonly form = this.fb.nonNullable.group({
    identifier: ['', [Validators.required, emailOrUsername]],
    // No length or format rules: the account was created by an Admin, and
    // second-guessing the rules at sign-in only ever blocks valid users.
    password: ['', [Validators.required]],
  });

  /** Cleared as soon as the user edits the field, so a stale error lingers no longer than the submit that raised it. */
  protected identifierError(): string | null {
    const control = this.form.controls.identifier;
    if (!control.touched) return null;
    if (control.hasError('required')) return 'Enter your email or username.';
    if (control.hasError('emailOrUsername')) return 'Enter a valid email address or username.';
    return null;
  }

  protected passwordError(): string | null {
    const control = this.form.controls.password;
    if (!control.touched) return null;
    if (control.hasError('required')) return 'Enter your password.';
    return null;
  }

  protected togglePasswordVisibility(): void {
    this.passwordVisible.update((visible) => !visible);
  }

  protected closeForgotPassword(): void {
    this.forgotPasswordOpen.set(false);
  }

  protected async onSubmit(): Promise<void> {
    this.authError.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    try {
      const role = await this.gateway.signIn(this.form.getRawValue());
      // The gateway returns the role and deliberately does not choose a
      // destination; routing on it is this page's decision, so a second entry
      // point could send the same result somewhere else.
      await this.router.navigate(['/', role, 'dashboard']);
    } catch (error) {
      this.authError.set(
        error instanceof Error ? error.message : 'We could not sign you in. Please try again.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
