import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Brand, Button, FormField } from '../../../shared/components';
import { ForgotPassword } from '../../components/forgot-password/forgot-password';
import { SupabaseService } from '../../../core/api/supabase.service';

/**
 * Staff sign-in for Admin, Doctor and Secretary.
 *
 * Authenticates against Supabase Auth (signInWithPassword) so accounts created
 * at /signup can log in here. After a successful sign-in the Supabase session
 * is stored in sessionStorage and the user is routed to a dashboard.
 *
 * Role-based routing to /admin | /doctor | /secretary is not yet possible
 * from Supabase Auth alone — the profiles table carries roles but RLS is
 * deny-all with no policies. Routes to /doctor/dashboard as a default landing.
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
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly authError = signal<string | null>(null);
  protected readonly passwordVisible = signal(false);
  protected readonly forgotPasswordOpen = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });

  /** Cleared as soon as the user edits the field, so a stale error lingers no longer than the submit that raised it. */
  protected emailError(): string | null {
    const control = this.form.controls.email;
    if (!control.touched) return null;
    if (control.hasError('required')) return 'Enter your email address.';
    if (control.hasError('email')) return 'Enter a valid email address.';
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
      const { email, password } = this.form.getRawValue();
      const { data, error } = await this.supabase.signIn(email, password);
      if (error) {
        throw error;
      }

      // Persist the Supabase session so subsequent requests can carry it.
      const session = data.session;
      if (session?.access_token) {
        sessionStorage.setItem('mediq_access_token', session.access_token);
        sessionStorage.setItem('mediq_user_email', data.user?.email ?? email);
      }

      // Supabase Auth does not return a role, so there is no role-based
      // destination yet. Land on the doctor dashboard as a default; the user
      // can navigate to another workspace from there. Role-based routing
      // requires RLS policies on the profiles table (out of scope here).
      try {
        await this.router.navigate(['/doctor/dashboard']);
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
