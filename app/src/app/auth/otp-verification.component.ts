import { Component, OnInit } from '@angular/core';
import { SupabaseService } from '../supabase.service';

@Component({
  selector: 'app-otp-verification',
  templateUrl: './otp-verification.component.html',
  styleUrls: ['./otp-verification.component.css']
})
export class OtpVerificationComponent implements OnInit {
  otp = '';
  isVerified = false;
  error: string = '';
  email: string = 'dr.smith@mediq.app'; // Default demo email

  constructor(private supabase: SupabaseService) {}

  ngOnInit() {
    // Set a default demo email - user can change this
    this.email = 'dr.smith@mediq.app';
  }

  /** Trigger Supabase OTP send - code will appear in UI inputs */
  startOtpVerification() {
    this.supabase.auth.signInWithOtp({
      email: this.email,
      options: {
        // The OTP code will be displayed in the 4 input fields below
        // redirectTo: window.location.origin  // Optional: where to go after success
      }
    }).then(({ error }) => {
      if (error) this.error = error.message;
      else console.log('OTP sent to', this.email);
    });
  }

  /** Handle input between the 4 OTP fields */
  onInput(event: any, index: number) {
    const value = event.target.value;
    this.otp += value;

    if (value && index < 3) {
      // Move focus to next input (triggered by DOM event)
      const nextInput = document.querySelectorAll('.otp-input')[index + 1];
      if (nextInput) nextInput.focus();
    } else if (!value && index > 0) {
      // Move focus back if cleared
      const prevInput = document.querySelectorAll('.otp-input')[index - 1];
      if (prevInput) prevInput.focus();
    }

    if (this.otp.length === 4) {
      this.verifyOtp();
    }
  }

  /** Verify the 4-digit OTP with Supabase */
  verifyOtp() {
    this.supabase.auth.verifyOtp({
      type: 'email',
      token: this.otp,
      // nextSignInMethod: 'password', // optional
      // redirectTo: window.location.origin  // optional
    }).then(({ data, error }) => {
      if (error) {
        this.error = 'Invalid OTP. Please try again.';
        this.otp = '';
        console.error('OTP verify error:', error);
      } else {
        this.isVerified = true;
        console.log('OTP verified! User logged in:', data);
        // Redirect or navigate home after successful verification
        // window.location.href = '/';
      }
    });
  }

  /** Resend the OTP */
  resendOtp() {
    this.startOtpVerification();
    this.otp = '';
    this.error = '';
  }