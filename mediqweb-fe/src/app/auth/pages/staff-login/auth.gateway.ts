import { InjectionToken } from '@angular/core';

/** What the sign-in form collects. Deliberately minimal — no role field. */
export interface StaffCredentials {
  readonly identifier: string;
  readonly password: string;
}

/**
 * The seam between the login UI and real authentication.
 *
 * The UI is built against this contract only, so wiring the HTTP call in a
 * later branch is a provider swap rather than a rewrite of the page. Nothing
 * in this contract may decide *where* a user lands after signing in — that is
 * the caller's job, and it depends on the role the API returns.
 */
export interface AuthGateway {
  /**
   * Resolves when the credentials are accepted, rejects otherwise.
   *
   * The rejection message is shown to the user verbatim, so implementations
   * must keep it safe to display: never leak whether the account exists or
   * whether the password was merely wrong.
   */
  signIn(credentials: StaffCredentials): Promise<void>;
}

export const AUTH_GATEWAY = new InjectionToken<AuthGateway>('MediQ auth gateway');
