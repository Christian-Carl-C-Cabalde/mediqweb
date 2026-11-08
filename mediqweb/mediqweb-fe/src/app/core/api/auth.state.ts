import { Injectable } from '@angular/core';
import { BehaviorSubject, distinctUntilChanged, map, Observable } from 'rxjs';
import { AuthSession, UserProfile } from './models';

@Injectable({ providedIn: 'root' })
export class AuthState {
  private session$ = new BehaviorSubject<AuthSession | null>(null);

  clear(): void {
    this.session$.next(null);
  }

  setSession(session: AuthSession): void {
    this.session$.next(session);
  }

  get accessToken(): string | null {
    return this.session$.value?.accessToken ?? null;
  }

  get refreshToken(): string | null {
    return this.session$.value?.refreshToken ?? null;
  }

  get isAuthenticated(): Observable<boolean> {
    return this.session$.pipe(
      map((s) => s != null),
      distinctUntilChanged(),
    );
  }

  get profile(): UserProfile | null {
    return this.session$.value?.profile ?? null;
  }

  get session(): Observable<AuthSession | null> {
    return this.session$;
  }
}
