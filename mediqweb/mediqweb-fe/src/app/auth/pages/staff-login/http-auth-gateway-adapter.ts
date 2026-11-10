import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  AUTH_GATEWAY,
  type AuthGateway,
  type StaffCredentials,
  type StaffRole,
} from './auth.gateway';
import { AuthService } from '../../../core/api/auth.service';
import { HttpAuthGateway } from '../../../core/api/http-auth-gateway';

/**
 * Adapts the real HTTP auth gateway to the `AuthGateway` contract the login
 * page expects. Returns the staff role parsed from the profile so routing to
 * `/admin | /doctor | /secretary` works unchanged.
 *
 * After sign-in the session is pushed onto `AuthService` so `AuthState` holds
 * the access token before navigation runs `authGuard`; otherwise the guard
 * sees no token and bounces the user back to `/login`.
 */
@Injectable()
export class HttpAuthGatewayAdapter implements AuthGateway {
  private readonly http = inject(HttpAuthGateway);
  private readonly authService = inject(AuthService);

  async signIn(credentials: StaffCredentials): Promise<StaffRole> {
    const session = await firstValueFrom(
      this.http.signIn(credentials.identifier, credentials.password),
    );
    this.authService.setSessionFromGateway(session);
    const role = (session.profile as { role?: string })?.role;
    if (!role || !['admin', 'doctor', 'secretary'].includes(role)) {
      throw new Error('Invalid credentials or the auth service is unreachable.');
    }
    return role as StaffRole;
  }
}

export const provideRealAuthGateway = () => ({
  provide: AUTH_GATEWAY,
  useClass: HttpAuthGatewayAdapter,
});
