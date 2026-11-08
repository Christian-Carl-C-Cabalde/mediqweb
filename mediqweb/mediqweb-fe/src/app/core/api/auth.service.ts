import { Injectable, inject } from '@angular/core';
import {
  BehaviorSubject,
  distinctUntilChanged,
  from,
  map,
  Observable,
  switchMap,
  throwError,
} from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { AuthSession, UserProfile } from './models';
import { AuthState } from './auth.state';
import { SupabaseService } from './supabase.service';

function mapProfile(row: any): UserProfile {
  return {
    id: row.user_id,
    username: row.username,
    fullName: row.full_name ?? '',
    email: row.email ?? '',
    mobileNumber: row.email ?? '',
    dateOfBirth: '',
    role: (row.role ?? 'patient') as UserProfile['role'],
    status: row.status ?? 'ACTIVE',
    assignedDoctorId: undefined,
  };
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase = inject(SupabaseService);
  private authState = inject(AuthState);

  private profile$ = new BehaviorSubject<UserProfile | null>(null);
  private accessToken$ = new BehaviorSubject<string | null>(null);

  constructor() {
    // Restore session/profile on startup.
    from(this.supabase.getSession()).subscribe(({ data }) => {
      const session = data.session;
      this.accessToken$.next(session?.access_token ?? null);
      if (session?.user) {
        this.loadProfile(session.user.id);
      }
    });
    // React to auth state changes (e.g. sign-out in another tab).
    this.supabase.onAuthStateChange((event, session) => {
      this.accessToken$.next(session?.access_token ?? null);
      if (event === 'SIGNED_OUT' || !session?.user) {
        this.authState.clear();
        this.profile$.next(null);
      } else if (event === 'SIGNED_IN' && session.user) {
        this.loadProfile(session.user.id);
      }
    });
  }

  private loadProfile(userId: string): void {
    from(this.supabase.getProfile(userId))
      .pipe(
        map((r: any) => (r.data ? mapProfile(r.data) : null)),
        catchError(() => [null as UserProfile | null]),
      )
      .subscribe((p) => {
        this.profile$.next(p);
      });
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

  signIn(emailOrUsername: string, password: string): Observable<AuthSession> {
    return from(this.resolveEmail(emailOrUsername)).pipe(
      switchMap((email) =>
        from(this.supabase.signIn(email, password)).pipe(
          switchMap((result: any) => {
            if (result.error || !result.data?.user) {
              return throwError(() => new Error(result.error?.message ?? 'Invalid credentials'));
            }
            return from(this.supabase.getProfile(result.data.user.id)).pipe(
              map((profileResult: any) => {
                if (profileResult.error || !profileResult.data) {
                  throw new Error('Profile not found');
                }
                const profile = mapProfile(profileResult.data);
                this.profile$.next(profile);
                const session = result.data.session;
                this.accessToken$.next(session?.access_token ?? null);
                const authSession: AuthSession = {
                  accessToken: session?.access_token ?? '',
                  expiresAt: session?.expires_at ?? '',
                  refreshToken: session?.refresh_token ?? '',
                  refreshExpiresAt: '',
                  profile,
                };
                this.authState.setSession(authSession);
                return authSession;
              }),
            );
          }),
        ),
      ),
      catchError((err) => throwError(() => err)),
    );
  }

  setSessionFromGateway(session: AuthSession): void {
    this.authState.setSession(session);
    this.profile$.next(session.profile);
    this.accessToken$.next(session.accessToken);
  }

  refresh(): Observable<AuthSession> {
    return from(this.supabase.getSession()).pipe(
      map(({ data }: any) => {
        const session = data.session;
        if (!session) {
          throw new Error('No session');
        }
        this.accessToken$.next(session.access_token);
        const profile = this.profile$.value;
        if (!profile) {
          throw new Error('No profile');
        }
        const authSession: AuthSession = {
          accessToken: session.access_token,
          expiresAt: session.expires_at ?? '',
          refreshToken: session.refresh_token,
          refreshExpiresAt: '',
          profile,
        };
        this.authState.setSession(authSession);
        return authSession;
      }),
      catchError((err) => throwError(() => err)),
    );
  }

  signOut(): void {
    this.supabase.signOut().catch(() => {
      // Ignore errors — clear local state regardless.
    });
    this.authState.clear();
    this.profile$.next(null);
    this.accessToken$.next(null);
  }

  get accessToken(): string | null {
    return this.accessToken$.value;
  }

  get profile(): UserProfile | null {
    return this.profile$.value;
  }

  get isAuthenticated$(): Observable<boolean> {
    return this.profile$.pipe(
      map((p) => p != null),
      distinctUntilChanged(),
    );
  }
}
