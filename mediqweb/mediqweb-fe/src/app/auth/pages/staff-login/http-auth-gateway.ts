import { Injectable, inject } from '@angular/core';
import { StaffCredentials, StaffRole } from './auth.gateway';
import { SupabaseService } from '../../../core/api/supabase.service';
import { AuthService } from '../../../core/api/auth.service';

@Injectable()
export class HttpAuthGateway {
  private readonly supabase = inject(SupabaseService);
  private readonly authService = inject(AuthService);

  async signIn(credentials: StaffCredentials): Promise<StaffRole> {
    // Resolve username → email if the identifier is not an email address.
    let email = credentials.identifier;
    if (!email.includes('@')) {
      const { data: profile, error: profileError } = await this.supabase
        .from('profiles')
        .select('email')
        .eq('username', email)
        .single();
      if (profileError || !profile?.email) {
        throw new Error('Invalid credentials');
      }
      email = profile.email;
    }

    const { data, error } = await this.supabase.signIn(email, credentials.password);
    if (error) throw error;

    // Ensure we have a valid access token. Supabase may return null session for certain flows.
    let accessToken: string | null = data.session?.access_token ?? null;
    if (!accessToken) {
      // Fallback: explicitly fetch the current session after sign‑in.
      const sessResult = await this.supabase.getSession();
      accessToken = sessResult?.data?.session?.access_token ?? null;
    }
    if (accessToken) {
      this.authService.accessToken$.next(accessToken);
    } else {
      throw new Error('Failed to obtain access token after sign‑in');
    }

    // Fetch profile to determine role for routing
    const { data: profileData } = await this.supabase.getProfile(data.user.id);
    if (profileData) {
      this.authService.profile$.next({
        id: profileData.user_id,
        username: profileData.username,
        fullName: profileData.full_name ?? '',
        email: profileData.email ?? '',
        mobileNumber: profileData.mobile_number ?? '',
        dateOfBirth: '',
        role: profileData.role?.toLowerCase() ?? 'patient',
        status: profileData.status ?? 'ACTIVE',
      });
    }

    const role = profileData?.role?.toLowerCase() ?? 'patient';
    return role as StaffRole;
  }
}