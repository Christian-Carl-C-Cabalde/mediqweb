import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
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

  function page(): any {
    return fixture.componentInstance;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function clickButton(label: string): void {
    const button = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === label,
    );
    expect(button).toBeTruthy();
    button!.click();
    fixture.detectChanges();
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

  it('confirms a booked appointment', () => {
    const booked = session.appointments().find((a) => a.status === 'booked')!;
    page().confirm(booked);
    fixture.detectChanges();
    expect(statusOf(booked.id)).toBe('confirmed');
    expect(text()).toContain('is confirmed');
  });

  it('completes a confirmed appointment', () => {
    const confirmed = session.appointments().find((a) => a.status === 'confirmed')!;
    page().complete(confirmed);
    fixture.detectChanges();
    expect(statusOf(confirmed.id)).toBe('completed');
  });

  it('records a no-show', () => {
    const confirmed = session.appointments().find((a) => a.status === 'confirmed')!;
    page().markNoShow(confirmed);
    fixture.detectChanges();
    expect(statusOf(confirmed.id)).toBe('no-show');
  });

  it('asks before cancelling, and cancelling does not happen on its own', () => {
    const confirmed = session.appointments().find((a) => a.status === 'confirmed')!;
    page().requestCancel(confirmed);
    fixture.detectChanges();

    expect(statusOf(confirmed.id)).toBe('confirmed');
    expect(text()).toContain('Cancel appointment');
  });

  it('cancels only once confirmed', () => {
    const confirmed = session.appointments().find((a) => a.status === 'confirmed')!;
    page().requestCancel(confirmed);
    page().confirmCancel();
    fixture.detectChanges();
    expect(statusOf(confirmed.id)).toBe('cancelled');
  });

  it('keeps the row after cancelling, rather than deleting the history', () => {
    const confirmed = session.appointments().find((a) => a.status === 'confirmed')!;
    const before = page().appointments().length;
    page().requestCancel(confirmed);
    page().confirmCancel();
    fixture.detectChanges();
    expect(page().appointments().length).toBe(before);
  });

  it('offers no forward action on a completed appointment', () => {
    const completed = session.appointments().find((a) => a.status === 'completed')!;
    expect(page().canCancel(completed)).toBe(false);
  });

  it('dismisses the confirmation', () => {
    const booked = session.appointments().find((a) => a.status === 'booked')!;
    page().confirm(booked);
    fixture.detectChanges();
    expect(text()).toContain('is confirmed');

    clickButton('Dismiss');
    expect(text()).not.toContain('is confirmed');
  });

  it('says who books appointments, so the missing create button is not a gap', () => {
    expect(text()).toContain('booked and rescheduled by a Secretary');
  });
});
