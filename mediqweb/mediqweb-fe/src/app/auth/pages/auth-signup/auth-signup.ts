import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Brand, Button, FormField, PasswordFields } from '../../../shared/components';
import { SupabaseService } from '../../../core/api/supabase.service';

/**
 * Public sign-up for fake/unowned emails.
 *
 * Creates a Supabase Auth account through the service_role admin API so no
 * confirmation email is sent and any email works immediately. Profiles are not
 * created here — Ktor owns `profiles` today, and auto sign-in after sign-up is
 * deliberately out of scope: the user lands on a success banner and signs in at
 * /login separately.
 */
@Component({
  selector: 'app-auth-signup',
  standalone: true,
  imports: [ReactiveFormsModule, Brand, Button, FormField, PasswordFields],
  templateUrl: './auth-signup.html',
  styleUrl: './auth-signup.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthSignup {
  private readonly fb = inject(FormBuilder);
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);

  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly createdEmail = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group(
    {
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordsMatch },
  );

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
    if (control.hasError('required')) return 'Enter a password.';
    if (control.hasError('minlength')) return 'Your password must be at least 6 characters.';
    return null;
  }

  protected confirmPasswordError(): string | null {
    const control = this.form.controls.confirmPassword;
    if (!control.touched) return null;
    if (control.hasError('required')) return 'Confirm your password.';
    return null;
  }

  protected async onSubmit(): Promise<void> {
    this.error.set(null);

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    try {
      const { email, password } = this.form.getRawValue();
      await this.supabase.createUser(email, password);
      this.createdEmail.set(email);
    } catch (err) {
      this.error.set(
        err instanceof Error ? err.message : 'We could not create your account. Please try again.',
      );
    } finally {
      this.loading.set(false);
    }
  }
}

function passwordsMatch(control: AbstractControl): ValidationErrors | null {
  const password = control.get('password')?.value;
  const confirm = control.get('confirmPassword')?.value;
  if (typeof password !== 'string' || typeof confirm !== 'string') return null;
  if (!password && !confirm) return null;
  return password === confirm ? null : { passwordsMismatch: true };
}
