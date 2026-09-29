import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminSession } from '../../admin-session';
import { StaffDirectory } from './staff-directory';

describe('StaffDirectory', () => {
  let fixture: ComponentFixture<StaffDirectory>;
  let session: AdminSession;

  async function render(kind: 'doctor' | 'secretary'): Promise<ComponentFixture<StaffDirectory>> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ imports: [StaffDirectory], providers: [AdminSession] });
    session = TestBed.inject(AdminSession);
    fixture = TestBed.createComponent(StaffDirectory);
    fixture.componentRef.setInput('kind', kind);
    fixture.detectChanges();
    await fixture.whenStable();
    return fixture;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function button(label: string): HTMLButtonElement | undefined {
    const buttons = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button'),
    );
    return buttons.find((b) => b.textContent?.trim() === label);
  }

  describe('doctors', () => {
    beforeEach(async () => {
      await render('doctor');
    });

    it('shows a specialization column, which secretaries do not get', () => {
      expect(text()).toContain('Specialization');
    });

    it('names the role in the search label and the add button', () => {
      expect(text()).toContain('Search Doctors');
      expect(text()).toContain('Add doctor');
    });

    it('lists every doctor from the session', () => {
      const dir = fixture.componentInstance as any;
      expect(dir['accounts']().length).toBe(session.doctors().length);
    });

    it('filters by name', () => {
      const dir = fixture.componentInstance as any;
      const target = session.doctors()[0].name;
      dir['query'].set(target);
      fixture.detectChanges();
      expect(dir['accounts']().length).toBe(1);
      expect(text()).toContain(target);
    });

    it('filters by status', () => {
      const dir = fixture.componentInstance as any;
      dir['statusFilter'].set('inactive');
      fixture.detectChanges();
      const rows = dir['accounts']();
      expect(rows.length).toBeGreaterThan(0);
      expect(rows.every((r: any) => r.status === 'inactive')).toBe(true);
    });

    it('reports when filters exclude everything', () => {
      const dir = fixture.componentInstance as any;
      dir['query'].set('no-such-person');
      fixture.detectChanges();
      expect(text()).toContain('No doctors match your filters.');
    });
  });

  describe('secretaries', () => {
    beforeEach(async () => {
      await render('secretary');
    });

    it('hides the specialization column and field', () => {
      expect(text()).not.toContain('Specialization');
    });

    it('does not require a specialization, so a secretary can be created', () => {
      const dir = fixture.componentInstance as any;
      dir['form'].setValue({
        firstName: 'New',
        lastName: 'Hire',
        email: 'new.hire@mediq.ph',
        specializationId: '',
        licenseNumber: '',
      });
      dir['submit']();
      fixture.detectChanges();
      expect(session.secretaries().some((s) => s.email === 'new.hire@mediq.ph')).toBe(true);
    });
  });

  describe('create account', () => {
    beforeEach(async () => {
      await render('doctor');
    });

    it('refuses an empty form and marks the fields touched', () => {
      const dir = fixture.componentInstance as any;
      const before = session.doctors().length;
      dir['submit']();
      fixture.detectChanges();
      expect(session.doctors().length).toBe(before);
      expect(dir['errorFor']('firstName')).toBe('This field is required.');
    });

    it('rejects a malformed email', () => {
      const dir = fixture.componentInstance as any;
      dir['form'].patchValue({ firstName: 'A', lastName: 'B', email: 'not-an-email' });
      dir['submit']();
      fixture.detectChanges();
      expect(dir['errorFor']('email')).toBe('Enter a valid email address.');
    });

    it('requires a specialization for a doctor', () => {
      const dir = fixture.componentInstance as any;
      dir['form'].patchValue({
        firstName: 'Ana',
        lastName: 'Reyes',
        email: 'ana.reyes@mediq.ph',
        specializationId: '',
      });
      dir['submit']();
      fixture.detectChanges();
      expect(dir['specializationError']()).toBe('Choose a specialization.');
      expect(session.doctors().some((d) => d.email === 'ana.reyes@mediq.ph')).toBe(false);
    });

    it('creates the account and announces it', () => {
      const dir = fixture.componentInstance as any;
      dir['form'].patchValue({
        firstName: 'Ana',
        lastName: 'Reyes',
        email: 'ana.reyes@mediq.ph',
        specializationId: 'spec-cardio',
        licenseNumber: 'PRC-1',
      });
      dir['submit']();
      fixture.detectChanges();
      expect(dir['notice']()).toContain('Ana Reyes');
      expect(dir['createOpen']()).toBe(false);
    });

    it('opens the dialog with a clean form', () => {
      const dir = fixture.componentInstance as any;
      dir['form'].patchValue({ firstName: 'Stale' });
      dir['openCreate']();
      expect(dir['createOpen']()).toBe(true);
      expect(dir['form'].getRawValue().firstName).toBe('');
    });
  });

  describe('enable and disable', () => {
    beforeEach(async () => {
      await render('doctor');
    });

    it('asks for confirmation before disabling', () => {
      const dir = fixture.componentInstance as any;
      const active = session.doctors().find((d) => d.status === 'active')!;
      dir['requestDisable'](active);
      fixture.detectChanges();
      expect(dir['confirmDisableFor']()).toEqual(active);
      // Nothing has changed yet.
      expect(session.doctors().find((d) => d.id === active.id)!.status).toBe('active');
    });

    it('disables only once confirmed', () => {
      const dir = fixture.componentInstance as any;
      const active = session.doctors().find((d) => d.status === 'active')!;
      dir['requestDisable'](active);
      dir['confirmDisable']();
      fixture.detectChanges();
      expect(session.doctors().find((d) => d.id === active.id)!.status).toBe('inactive');
    });

    it('leaves the account alone when the confirmation is cancelled', () => {
      const dir = fixture.componentInstance as any;
      const active = session.doctors().find((d) => d.status === 'active')!;
      dir['requestDisable'](active);
      dir['cancelDisable']();
      dir['confirmDisable']();
      expect(session.doctors().find((d) => d.id === active.id)!.status).toBe('active');
    });

    it('re-enables a disabled account', () => {
      const dir = fixture.componentInstance as any;
      const inactive = session.doctors().find((d) => d.status === 'inactive')!;
      dir['enable'](inactive);
      fixture.detectChanges();
      expect(session.doctors().find((d) => d.id === inactive.id)!.status).toBe('active');
    });
  });

  it('states plainly that the data is a sample', async () => {
    await render('doctor');
    expect(text()).toContain('Sample data.');
  });

  it('offers an add button that opens the create dialog', async () => {
    await render('doctor');
    const dir = fixture.componentInstance as any;
    expect(dir['createOpen']()).toBe(false);
    button('Add doctor')?.click();
    fixture.detectChanges();
    expect(dir['createOpen']()).toBe(true);
  });
});
