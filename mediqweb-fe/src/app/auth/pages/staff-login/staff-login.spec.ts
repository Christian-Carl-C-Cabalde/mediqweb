import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { StaffLogin } from './staff-login';
import { AUTH_GATEWAY, AuthGateway, StaffCredentials, StaffRole } from './auth.gateway';
import { emailOrUsername } from './staff-login.validators';

describe('emailOrUsername', () => {
  const run = (value: string) => emailOrUsername({ value } as never);

  it('defers the empty case to required', () => {
    expect(run('')).toBeNull();
    expect(run('   ')).toBeNull();
  });

  it('accepts an email address', () => {
    expect(run('nurse@mediq.ph')).toBeNull();
  });

  it('accepts a username', () => {
    expect(run('j.delacruz')).toBeNull();
    expect(run('juan_dc-01')).toBeNull();
  });

  it('rejects malformed values', () => {
    expect(run('nurse@mediq')).not.toBeNull();
    expect(run('nurse @mediq.ph')).not.toBeNull();
    expect(run('ab')).not.toBeNull();
  });
});

describe('StaffLogin', () => {
  let fixture: ComponentFixture<StaffLogin>;
  let router: Router;
  let submitted: StaffCredentials[];
  let resolveSignIn: ((role: StaffRole) => void) | null;
  let rejectSignIn: ((error: Error) => void) | null;

  const host = () => fixture.nativeElement as HTMLElement;
  const form = () => fixture.componentInstance['form'];
  const query = <T extends HTMLElement>(selector: string) => host().querySelector<T>(selector)!;
  const queryAll = (selector: string) => Array.from(host().querySelectorAll<HTMLElement>(selector));

  beforeEach(async () => {
    submitted = [];

    const gateway: AuthGateway = {
      signIn: (credentials) => {
        submitted.push(credentials);
        return new Promise<StaffRole>((resolve, reject) => {
          resolveSignIn = resolve;
          rejectSignIn = reject;
        });
      },
    };

    await TestBed.configureTestingModule({
      imports: [StaffLogin],
      // A router has to exist because a successful sign-in navigates.
      providers: [provideRouter([])],
    })
      .overrideComponent(StaffLogin, {
        set: { providers: [{ provide: AUTH_GATEWAY, useValue: gateway }] },
      })
      .compileComponents();

    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(StaffLogin);
    fixture.detectChanges();
  });

  const type = (control: 'identifier' | 'password', value: string) => {
    const input = query<HTMLInputElement>(`[formcontrolname="${control}"]`);
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  };

  const submit = async () => {
    query<HTMLFormElement>('form').dispatchEvent(new Event('submit'));
    fixture.detectChanges();
    await Promise.resolve();
    fixture.detectChanges();
  };

  /**
   * Drains everything a resolved sign-in sets off.
   *
   * `whenStable` alone is not enough once the gateway resolves: the continuation
   * calls `navigate`, and *its* rejection is a further microtask before the
   * catch runs. Yielding to a macrotask empties the whole queue, so the test is
   * asserting on a page that has actually finished rather than one caught
   * between two ticks.
   */
  const settle = async () => {
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();
  };

  it('renders the MediQ brand and a single sign-in heading', () => {
    expect(query('ui-brand')).toBeTruthy();
    expect(query('h1').textContent?.trim()).toBe('Sign in');
  });

  it('offers no registration path', () => {
    // Staff accounts are created by an Admin, so no sign-up affordance exists.
    const text = host().textContent?.toLowerCase() ?? '';
    expect(text).not.toContain('register');
    expect(text).not.toContain('sign up');
    expect(text).not.toContain('create an account');
  });

  it('starts with the password hidden and toggles it', () => {
    const input = query<HTMLInputElement>('#staff-password');
    expect(input.type).toBe('password');

    query<HTMLButtonElement>('.login__reveal').click();
    fixture.detectChanges();
    expect(query<HTMLInputElement>('#staff-password').type).toBe('text');
    expect(query<HTMLButtonElement>('.login__reveal').getAttribute('aria-label')).toBe(
      'Hide password',
    );

    query<HTMLButtonElement>('.login__reveal').click();
    fixture.detectChanges();
    expect(query<HTMLInputElement>('#staff-password').type).toBe('password');
  });

  it('does not submit an empty form and marks the fields touched', async () => {
    await submit();

    expect(submitted).toHaveLength(0);
    expect(form().touched).toBe(true);
    expect(query('.ui-form-field__help--error')?.textContent).toContain(
      'Enter your email or username.',
    );
    expect(query('.login__input').getAttribute('aria-invalid')).toBe('true');
  });

  it('rejects a malformed identifier without calling the gateway', async () => {
    type('identifier', 'nurse@mediq');
    type('password', 'correct-horse');
    await submit();

    expect(submitted).toHaveLength(0);
    expect(host().textContent).toContain('Enter a valid email address or username.');
  });

  it('submits the credentials and shows the loading state', async () => {
    type('identifier', 'nurse@mediq.ph');
    type('password', 'correct-horse');

    const formEl = query<HTMLFormElement>('form');
    formEl.dispatchEvent(new Event('submit'));
    fixture.detectChanges();

    expect(submitted).toEqual([{ identifier: 'nurse@mediq.ph', password: 'correct-horse' }]);

    const button = query<HTMLButtonElement>('ui-button button');
    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(query('ui-button ui-spinner')).toBeTruthy();
  });

  it('surfaces a rejected sign-in and clears the loading state', async () => {
    type('identifier', 'nurse@mediq.ph');
    type('password', 'wrong');
    await submit();
    rejectSignIn!(new Error('Email or password is incorrect.'));
    await fixture.whenStable();
    fixture.detectChanges();

    const alert = query('.login__alert');
    expect(alert.getAttribute('role')).toBe('alert');
    expect(alert.textContent).toContain('Email or password is incorrect.');
    expect(query<HTMLButtonElement>('ui-button button').disabled).toBe(false);
  });

  it('leaves the form usable after a failed attempt', async () => {
    type('identifier', 'nurse@mediq.ph');
    type('password', 'wrong');
    await submit();
    rejectSignIn!(new Error('Email or password is incorrect.'));
    await fixture.whenStable();
    fixture.detectChanges();

    expect(queryAll('.login__alert')).toHaveLength(1);

    // A second attempt must clear the previous error rather than stack it.
    await submit();
    expect(queryAll('.login__alert')).toHaveLength(0);
    expect(submitted).toHaveLength(2);
  });

  it('opens the forgot-password dialog with administrator guidance', async () => {
    const link = queryAll('.login__link')[0];
    link.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const dialog = query<HTMLDialogElement>('dialog');
    expect(dialog.hasAttribute('open')).toBe(true);
    expect(dialog.textContent).toContain('created by an administrator');
  });

  it('assists the identifier and password fields', () => {
    expect(query<HTMLInputElement>('#staff-identifier').getAttribute('autocomplete')).toBe(
      'username',
    );
    expect(query<HTMLInputElement>('#staff-password').getAttribute('autocomplete')).toBe(
      'current-password',
    );
  });

  it('sends a signed-in user to the dashboard for the role returned', async () => {
    // The gateway decides who you are, not where you land; routing on the role
    // is this page's job.
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    type('identifier', 'secretary');
    type('password', '123123');
    await submit();
    resolveSignIn!('secretary');
    await fixture.whenStable();

    expect(navigate).toHaveBeenCalledWith(['/', 'secretary', 'dashboard']);
  });

  it('does not navigate when the credentials are rejected', async () => {
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    type('identifier', 'admin');
    type('password', 'wrong');
    await submit();
    rejectSignIn!(new Error('Email or password is incorrect.'));
    await fixture.whenStable();

    expect(navigate).not.toHaveBeenCalled();
  });

  it('does not blame the credentials when the workspace fails to open', async () => {
    // The gateway accepted these credentials; only the redirect failed. Telling
    // the user their email or password is wrong sends them off to retype a
    // password that worked — the single most misleading thing this page could
    // say. Reachable in practice: every staff route is a lazy chunk, so a deploy
    // that replaces a chunk under an open tab fails the navigation.
    vi.spyOn(router, 'navigate').mockRejectedValue(new Error('Failed to fetch chunk'));
    type('identifier', 'secretary');
    type('password', '123123');
    await submit();
    resolveSignIn!('secretary');
    await settle();

    const alert = query('.login__alert');
    expect(alert.textContent).toContain('could not open your workspace');
    expect(alert.textContent).not.toContain('incorrect');
    expect(alert.textContent).not.toContain('could not sign you in');
  });

  it('says nothing about a session when the redirect fails', async () => {
    // `AuthGateway` stores nothing today and the real one may store a token, so
    // the page cannot claim the user is signed in — or not. Asserted because the
    // tempting wording ("you are signed in, but…") would be true of the API and
    // false of the scaffolding sitting behind it.
    vi.spyOn(router, 'navigate').mockRejectedValue(new Error('Failed to fetch chunk'));
    type('identifier', 'secretary');
    type('password', '123123');
    await submit();
    resolveSignIn!('secretary');
    await settle();

    const text = query('.login__alert').textContent?.toLowerCase() ?? '';
    expect(text).not.toContain('signed in');
    expect(text).not.toContain('session');
    expect(text).not.toContain('logged in');
  });

  it('releases the button when the redirect fails', async () => {
    // Otherwise the form sticks on a spinner with no way forward except a
    // reload, which is the one recovery the user cannot see they need.
    vi.spyOn(router, 'navigate').mockRejectedValue(new Error('Failed to fetch chunk'));
    type('identifier', 'secretary');
    type('password', '123123');
    await submit();
    resolveSignIn!('secretary');
    await settle();

    const button = query<HTMLButtonElement>('ui-button button');
    expect(button.disabled).toBe(false);
    // `[attr.aria-busy]="loading()"` binds the boolean, so an idle button carries
    // the string "false" rather than dropping the attribute — asserting on the
    // value, not on its presence.
    expect(button.getAttribute('aria-busy')).toBe('false');
    expect(query('ui-button ui-spinner')).toBeFalsy();
  });

  it('prints the sample accounts, labelled as scaffolding', () => {
    // A credential nobody can discover is worse than none, and an unlabelled
    // one looks like a real account.
    const text = host().textContent ?? '';
    expect(text).toContain('Sample accounts');
    expect(text).toContain('admin');
    expect(text).toContain('doctor');
    expect(text).toContain('secretary');
    expect(text).toContain('123123');
    expect(text).toContain('scaffolding');
  });

  it('labels the sample block as a heading, so it is reachable by screen reader', () => {
    const section = query('.samples');
    const heading = query<HTMLHeadingElement>('.samples__heading');
    expect(heading.tagName).toBe('H2');
    expect(section.getAttribute('aria-labelledby')).toBe(heading.id);
  });
});
