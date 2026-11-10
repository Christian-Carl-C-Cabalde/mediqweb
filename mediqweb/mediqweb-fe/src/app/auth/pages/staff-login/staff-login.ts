import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Brand, Button, FormField } from '../../../shared/components';
import { ForgotPassword } from '../../components/forgot-password/forgot-password';
import { AuthService } from '../../../core/api/auth.service';
import { UserProfile } from '../../../core/api/models';
import { AUTH_GATEWAY } from './auth.gateway';
import { emailOrUsername } from './staff-login.validators';
import { MockAuthGateway } from './mock-auth.gateway';

const MOCK_PROFILES: Record<string, UserProfile> = {
  admin: {
    id: 'admin-001',
    username: 'admin',
    fullName: 'Admin User',
    email: 'admin@mediq.app',
    mobileNumber: '+639170000000',
    dateOfBirth: '1985-01-01',
    role: 'admin',
    status: 'ACTIVE',
  },
  doctor: {
    id: 'doc-002',
    username: 'doctor',
    fullName: 'Doctor User',
    email: 'doctor@mediq.app',
    mobileNumber: '+639171234567',
    dateOfBirth: '1980-05-15',
    role: 'doctor',
    status: 'ACTIVE',
  },
  secretary: {
    id: 'sec-001',
    username: 'secretary',
    fullName: 'Secretary User',
    email: 'secretary@mediq.app',
    mobileNumber: '+639173456789',
    dateOfBirth: '1990-03-10',
    role: 'secretary',
    status: 'ACTIVE',
  },
};

/**
 * Staff sign-in for Admin, Doctor and Secretary.
 *
 * There is deliberately no registration path: staff accounts are created by an
 * Admin, so the only way in is an existing account. The "forgot password"
 * route therefore explains who to contact instead of pretending to email a
 * reset link.
 *
 * Calls the real auth gateway (direct to Ktor) on submit.
 */
@Component({
  selector: 'app-staff-login',
  imports: [ReactiveFormsModule, Brand, Button, FormField, ForgotPassword],
  templateUrl: './staff-login.html',
  styleUrl: './staff-login.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
    providers: [
      // Mock auth gateway — bypasses Supabase Auth entirely for local dev.
      { provide: AUTH_GATEWAY, useClass: MockAuthGateway },
    ],
})
export class StaffLogin {
  private readonly fb = inject(FormBuilder);
  private readonly gateway = inject(AUTH_GATEWAY);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly authError = signal<string | null>(null);
  protected readonly passwordVisible = signal(false);
  protected readonly forgotPasswordOpen = signal(false);

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
      const profile = MOCK_PROFILES[role];
      const now = new Date();
      const oneHour = new Date(now.getTime() + 60 * 60 * 1000).toISOString();
      this.auth.setSessionFromGateway({
        accessToken: `mock-${role}-token`,
        expiresAt: oneHour,
        refreshToken: `mock-${role}-refresh`,
        refreshExpiresAt: oneHour,
        profile,
      });
      // The gateway returns the role and deliberately does not choose a
      // destination; routing on it is this page's decision, so a second entry
      // point could send the same result somewhere else.
      //
      // Navigation carries its own catch rather than sharing the one below. It
      // used to sit inside this `try`, so a redirect that failed was reported as
      // a rejected sign-in — telling the user their email or password was wrong
      // when the gateway had just accepted it. That is the one thing they are
      // not, and it sends them off to retype a password that was fine.
      //
      // The wording stays silent on whether a session now exists: `AuthGateway`
      // holds none today, and the real one may. This page cannot know, so it
      // does not claim either way.
      try {
        await this.router.navigate(['/', role, 'dashboard']);
      } catch {
        this.authError.set('We could not open your workspace. Please try again.');
      }
    } catch (error) {
      this.authError.set(
        error instanceof Error ? error.message : 'We could not sign you in. Please try again.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}
