import { Injectable } from '@angular/core';
import { AuthGateway, StaffCredentials, StaffRole } from './auth.gateway';

/** One sample staff account. */
interface MockAccount {
  readonly identifier: string;
  readonly password: string;
  readonly role: StaffRole;
}

/**
 * The sample accounts the sign-in screen accepts.
 *
 * Exported so the login page can print them, which is the only reason a
 * hardcoded password is defensible here: a credential nobody can discover is
 * worse than none, and an unlabelled one looks like a real account. Every one
 * of these must be deleted when the API branch lands — see `MockAuthGateway`.
 */
export const MOCK_STAFF_ACCOUNTS: readonly MockAccount[] = [
  { identifier: 'admin', password: '123123', role: 'admin' },
  { identifier: 'doctor', password: '123123', role: 'doctor' },
  { identifier: 'secretary', password: '123123', role: 'secretary' },
];

/**
 * Stands in for the auth endpoint until the API branch lands.
 *
 * Checks credentials against `MOCK_STAFF_ACCOUNTS` so the sign-in screen can be
 * walked end to end, and returns the role so the page can route. It holds no
 * session: there is nothing to store, and the staff areas each keep their own
 * mock identity. **This whole file is scaffolding** — the real implementation
 * replaces it with an HTTP call and the accounts above disappear with it.
 */
@Injectable()
export class MockAuthGateway implements AuthGateway {
  /** Long enough for the button's loading state to be seen rather than inferred. */
  private static readonly LATENCY_MS = 400;

  signIn(credentials: StaffCredentials): Promise<StaffRole> {
    const identifier = credentials.identifier.trim().toLowerCase();
    const account = MOCK_STAFF_ACCOUNTS.find(
      (candidate) =>
        candidate.identifier === identifier && candidate.password === credentials.password,
    );

    return new Promise<StaffRole>((resolve, reject) => {
      setTimeout(() => {
        if (account) {
          resolve(account.role);
        } else {
          // One message for a wrong password and an unknown account alike: a
          // different error for each would confirm which usernames exist.
          reject(new Error('Email or password is incorrect.'));
        }
      }, MockAuthGateway.LATENCY_MS);
    });
  }
}
