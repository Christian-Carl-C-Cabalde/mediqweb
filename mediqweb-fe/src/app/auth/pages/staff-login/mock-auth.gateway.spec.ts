import {
  resetStoredPasswords,
  storePassword,
} from '../../../core/services/password-store';
import { MOCK_STAFF_ACCOUNTS, MockAuthGateway } from './mock-auth.gateway';

describe('MockAuthGateway', () => {
  const gateway = new MockAuthGateway();

  // The password store is module-scoped, so it outlives every test in this file.
  beforeEach(() => resetStoredPasswords());

  const attempt = (identifier: string, password: string) =>
    gateway.signIn({ identifier, password });

  it('accepts each sample account and returns its role', async () => {
    await expect(attempt('admin', '123123')).resolves.toBe('admin');
    await expect(attempt('doctor', '123123')).resolves.toBe('doctor');
    await expect(attempt('secretary', '123123')).resolves.toBe('secretary');
  });

  it('covers all three workspaces', () => {
    // Guards against an account being added for a role that has no landing
    // route, which would sign a user in and then dead-end them.
    expect([...MOCK_STAFF_ACCOUNTS].map((account) => account.role).sort()).toEqual([
      'admin',
      'doctor',
      'secretary',
    ]);
  });

  it('gives every sample account the same password', async () => {
    for (const account of MOCK_STAFF_ACCOUNTS) {
      await expect(attempt(account.identifier, '123123')).resolves.toBe(account.role);
    }
  });

  it('tolerates surrounding whitespace and mixed case in the identifier', async () => {
    await expect(attempt('  ADMIN  ', '123123')).resolves.toBe('admin');
  });

  it('rejects a wrong password', async () => {
    await expect(attempt('admin', 'nope')).rejects.toThrow('Email or password is incorrect.');
  });

  it('rejects an unknown account', async () => {
    await expect(attempt('nobody', '123123')).rejects.toThrow('Email or password is incorrect.');
  });

  it('gives the same message for a wrong password and an unknown account', async () => {
    // Two different errors would confirm which usernames exist.
    const wrongPassword = await attempt('admin', 'nope').catch((e: Error) => e.message);
    const unknownAccount = await attempt('nobody', '123123').catch((e: Error) => e.message);
    expect(wrongPassword).toBe(unknownAccount);
  });

  it('does not accept one account’s password on another account', async () => {
    // Guards against a comparison that checks only the identifier.
    const passwords = MOCK_STAFF_ACCOUNTS.map((account) => account.password);
    const shared = passwords.every((password) => password === passwords[0]);
    expect(shared).toBe(true);

    await expect(attempt('doctor', `${passwords[0]}4`)).rejects.toThrow();
  });

  describe('after a password change', () => {
    it('accepts the new password', async () => {
      const doctor = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'doctor')!;
      storePassword(doctor.accountId, 'clinic-portal-2026');

      await expect(attempt('doctor', 'clinic-portal-2026')).resolves.toBe('doctor');
    });

    it('stops accepting the old one', async () => {
      // A reset that reports success and leaves the previous password working
      // would be the one outcome that makes the whole feature a lie.
      const doctor = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'doctor')!;
      storePassword(doctor.accountId, 'clinic-portal-2026');

      await expect(attempt('doctor', '123123')).rejects.toThrow(
        'Email or password is incorrect.',
      );
    });

    it('leaves the other accounts alone', async () => {
      const doctor = MOCK_STAFF_ACCOUNTS.find((account) => account.role === 'doctor')!;
      storePassword(doctor.accountId, 'clinic-portal-2026');

      await expect(attempt('secretary', '123123')).resolves.toBe('secretary');
      await expect(attempt('admin', '123123')).resolves.toBe('admin');
    });

    it('is unaffected for an account that was never changed', async () => {
      await expect(attempt('doctor', '123123')).resolves.toBe('doctor');
    });
  });
});
