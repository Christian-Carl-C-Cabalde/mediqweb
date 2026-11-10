import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Brand, Button, FormField } from '../../../shared/components';
import { ForgotPassword } from '../../components/forgot-password/forgot-password';
import { AUTH_GATEWAY, StaffRole } from './auth.gateway';
import { emailOrUsername } from './staff-login.validators';

/**
 * Staff sign-in for Admin, Doctor and Secretary.
 *
 * Delegates authentication to the `AUTH_GATEWAY` seam so the page stays
 * agnostic of *how* credentials are verified (Supabase Auth today, Ktor
 * tomorrow). On success the gateway returns the staff role and this page
 * routes to the matching dashboard. The Supabase session (access token,
 * profile) is owned by `AuthService` once the gateway signs in.
 */
@Component({
  selector: 'app-staff-login',
  standalone: true,
  imports: [ReactiveFormsModule, Brand, Button, FormField, ForgotPassword],
  templateUrl: './staff-login.html',
  styleUrl: './staff-login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffLogin {
  private readonly fb = inject(FormBuilder);
  private readonly gateway = inject(AUTH_GATEWAY);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly authError = signal<string | null>(null);
  protected readonly passwordVisible = signal(false);
  protected readonly forgotPasswordOpen = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    identifier: ['', [Validators.required, emailOrUsername]],
    password: ['', [Validators.required]],
  });

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
      const { identifier, password } = this.form.getRawValue();
      const role = await this.gateway.signIn({ identifier, password });

      const route =
        role === 'admin'
          ? '/admin/dashboard'
          : role === 'doctor'
            ? '/doctor/dashboard'
            : '/secretary/dashboard';
      try {
        await this.router.navigate([route]);
      } catch {
        this.authError.set('We could not open your workspace. Please try again.');
      }
    } catch (err) {
      this.authError.set(
        err instanceof Error ? err.message : 'We could not sign you in. Please try again.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
