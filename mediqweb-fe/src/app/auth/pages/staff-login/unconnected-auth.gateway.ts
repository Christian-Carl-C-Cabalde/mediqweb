import { Injectable } from '@angular/core';
import { AuthGateway, StaffCredentials } from './auth.gateway';

/**
 * Placeholder used until the API branch lands.
 *
 * It stands in for the network round trip so the page's loading and error
 * states are exercised for real rather than being dead markup. It performs no
 * credential checking and never authenticates anyone.
 */
@Injectable()
export class UnconnectedAuthGateway implements AuthGateway {
  signIn(_credentials: StaffCredentials): Promise<void> {
    return Promise.reject(
      new Error('Sign-in is not connected yet. This branch ships the interface only.'),
    );
  }
}
