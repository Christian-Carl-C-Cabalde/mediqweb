import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import {
  clearToasts,
  latestToast,
  toasts,
} from '../../../core/services/toast.service.spec-helpers';
import { MOCK_APPOINTMENTS } from '../../doctor.mock-data';
import { DoctorSession } from '../../doctor-session';
import { DoctorAppointments } from './doctor-appointments';

describe('DoctorAppointments', () => {
  let fixture: ComponentFixture<DoctorAppointments>;
  let session: DoctorSession;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [DoctorAppointments],
      // The table links into the patient routes, so a router has to exist even
      // though the test never navigates.
      providers: [DoctorSession, provideRouter([])],
    });
    session = TestBed.inject(DoctorSession);
    session.now.set(new Date(MOCK_APPOINTMENTS[0].startsAt));
    fixture = TestBed.createComponent(DoctorAppointments);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  // Disarms the dismissal timers the toasts arm.
  afterEach(() => clearToasts());

  function page(): any {
    return fixture.componentInstance;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function button(label: string): HTMLButtonElement | undefined {
    return [...host().querySelectorAll<HTMLButtonElement>('button')].find(
      (b) => b.textContent?.trim() === label,
    );
  }

  function clickButton(label: string): void {
    const found = button(label);
    expect(found).toBeTruthy();
    found!.click();
    fixture.detectChanges();
  }

  /** Every button in the Actions cell of every rendered row. */
  function rowActions(): string[] {
    return [...host().querySelectorAll('tbody tr')].flatMap((row) =>
      [...row.querySelectorAll('.actions button')].map((b) => b.textContent?.trim() ?? ''),
    );
  }

  function statusOf(id: string): string | undefined {
    return session.appointments().find((a) => a.id === id)?.status;
  }

  it('lists every appointment for the signed-in doctor', () => {
    expect(page().appointments().length).toBe(session.appointments().length);
  });

  it('filters by patient name', () => {
    page().query.set('juan');
    fixture.detectChanges();
    expect(page().appointments().length).toBeGreaterThan(0);
    for (const appointment of page().appointments()) {
      expect(session.patientName(appointment.patientId).toLowerCase()).toContain('juan');
    }
  });

  it('filters by reason', () => {
    page().query.set('knee');
    fixture.detectChanges();
    expect(page().appointments().length).toBeGreaterThan(0);
  });

  it('filters by status', () => {
    page().statusFilter.set('cancelled');
    fixture.detectChanges();
    for (const appointment of page().appointments()) {
      expect(appointment.status).toBe('cancelled');
    }
  });

  it('explains an empty result rather than showing a bare table', () => {
    page().query.set('nobody by this name');
    fixture.detectChanges();
    expect(text()).toContain('No appointments match your filters');
  });

  it('completes a confirmed appointment', () => {
    const confirmed = session.appointments().find((a) => a.status === 'confirmed')!;
    page().complete(confirmed);
    fixture.detectChanges();
    expect(statusOf(confirmed.id)).toBe('completed');
    expect(latestToast()?.title).toBe('Visit recorded');
  });

  it('records a no-show', () => {
    const confirmed = session.appointments().find((a) => a.status === 'confirmed')!;
    page().markNoShow(confirmed);
    fixture.detectChanges();
    expect(statusOf(confirmed.id)).toBe('no-show');
    // A warning rather than a success: the write worked, but it is bad news about
    // the appointment and would otherwise read as a neutral "done".
    expect(latestToast()?.tone).toBe('warning');
  });

  it('records an outcome immediately, with no confirmation dialog', () => {
    const confirmed = session.appointments().find((a) => a.status === 'confirmed')!;
    page().complete(confirmed);
    fixture.detectChanges();

    // Recording an outcome is immediate, with no confirmation dialog: it is a
    // record of something the doctor just saw, not a decision to be asked about.
    expect(statusOf(confirmed.id)).toBe('completed');
    expect(host().querySelector('dialog')).toBeNull();
  });

  it('dismisses the confirmation', () => {
    const confirmed = session.appointments().find((a) => a.status === 'confirmed')!;
    page().complete(confirmed);
    fixture.detectChanges();
    expect(latestToast()).not.toBeNull();

    toasts().dismiss(latestToast()!.id);
    fixture.detectChanges();
    expect(latestToast()).toBeNull();
  });

  // --- What this desk is not allowed to do

  it('offers no Confirm, because only a Secretary approves an appointment', () => {
    const booked = session.appointments().find((a) => a.status === 'booked')!;
    expect(page().canRecord(booked)).toBe(false);
    expect(button('Confirm')).toBeUndefined();
    expect(text()).not.toContain('Confirm');
  });

  it('offers no Cancel, because calling a booking off is the front desk decision', () => {
    // The handler and its dialog are gone with it, not merely unreachable.
    expect(page().requestCancel).toBeUndefined();
    expect(page().confirmCancel).toBeUndefined();
    expect(page().canCancel).toBeUndefined();
    expect(host().querySelector('dialog')).toBeNull();
    expect(button('Cancel appointment')).toBeUndefined();
  });

  it('shows only Complete and No-show, and only on a confirmed appointment', () => {
    const labels = rowActions();
    expect(new Set(labels)).toEqual(new Set(['Complete', 'No-show']));

    // One pair per confirmed appointment, and no other row carries an action.
    const confirmed = page()
      .appointments()
      .filter((a: any) => a.status === 'confirmed').length;
    expect(labels.length).toBe(confirmed * 2);
  });

  it('refuses to record an outcome on a booking the front desk never confirmed', () => {
    // Defence in depth behind the hidden buttons: the rule lives in the store, so
    // reaching past the template still gets a refusal rather than a write.
    const booked = session.appointments().find((a) => a.status === 'booked')!;
    expect(session.recordOutcome(booked.id, 'completed')).toBe(false);
    expect(statusOf(booked.id)).toBe('booked');
  });

  it('says which decisions belong to the Secretary', () => {
    // The absence of Confirm and Cancel reads as a gap unless the page says
    // otherwise. This is the sentence that stops that.
    expect(text()).toContain(
      'A Secretary at the front desk confirms an appointment and calls it off',
    );
  });
});
