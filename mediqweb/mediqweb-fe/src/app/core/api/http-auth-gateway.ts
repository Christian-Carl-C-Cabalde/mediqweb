import { Injectable, inject } from '@angular/core';
import { from, map, Observable, switchMap } from 'rxjs';
import { AuthSession, UserProfile } from './models';
import { SupabaseService } from './supabase.service';

@Injectable({ providedIn: 'root' })
export class HttpAuthGateway {
  private supabase = inject(SupabaseService);

  signIn(emailOrUsername: string, password: string): Observable<AuthSession> {
    return from(this.resolveEmail(emailOrUsername)).pipe(
      switchMap((email) =>
        from(this.supabase.signIn(email, password)).pipe(
          switchMap((result: any) => {
            if (result.error || !result.data?.user) {
              throw new Error(result.error?.message ?? 'Invalid credentials');
            }
            return from(
              (this.supabase as any)
                .from('profiles')
                .select('*')
                .eq('user_id', result.data.user.id)
                .single(),
            ).pipe(
              map((profileResult: any) => {
                if (profileResult.error || !profileResult.data) {
                  throw new Error('Profile not found');
                }
                const p = profileResult.data;
                const session: AuthSession = {
                  accessToken: result.data.session?.access_token ?? '',
                  expiresAt: result.data.session?.expires_at ?? '',
                  refreshToken: result.data.session?.refresh_token ?? '',
                  refreshExpiresAt: '',
                  profile: {
                    id: p.user_id,
                    username: p.username,
                    fullName: p.full_name ?? '',
                    email: p.email ?? '',
                    mobileNumber: p.email ?? '',
                    dateOfBirth: '',
                    role: ((p.role ?? 'patient') as string).toLowerCase() as UserProfile['role'],
                    status: p.status ?? 'ACTIVE',
                    joinedOn: p.created_at ?? '',
                  },
                };
                return session;
              }),
            );
          }),
        ),
      ),
    );
  }

  getProfile(): Observable<UserProfile> {
    return from(this.supabase.getUser()).pipe(
      switchMap((result: any) => {
        if (result.error || !result.data?.user) {
          throw new Error('Not authenticated');
        }
        return from(
          (this.supabase as any)
            .from('profiles')
            .select('*')
            .eq('user_id', result.data.user.id)
            .single(),
        ).pipe(
          map((profileResult: any) => {
            if (profileResult.error || !profileResult.data) {
              throw new Error('Profile not found');
            }
            const p = profileResult.data;
            return {
              id: p.user_id,
              username: p.username,
              fullName: p.full_name ?? '',
              email: p.email ?? '',
              mobileNumber: p.email ?? '',
              dateOfBirth: '',
              role: ((p.role ?? 'patient') as string).toLowerCase() as UserProfile['role'],
              status: p.status ?? 'ACTIVE',
              joinedOn: p.created_at ?? '',
            } as UserProfile;
          }),
        );
      }),
    );
  }

  private resolveEmail(emailOrUsername: string): Promise<string> {
    if (emailOrUsername.includes('@')) {
      return Promise.resolve(emailOrUsername);
    }
    return (this.supabase as any)
      .from('profiles')
      .select('email')
      .eq('username', emailOrUsername)
      .single()
      .then((r: any) => {
        if (r.error || !r.data) {
          throw new Error('Invalid credentials');
        }
        return r.data.email;
      });
  }
}
