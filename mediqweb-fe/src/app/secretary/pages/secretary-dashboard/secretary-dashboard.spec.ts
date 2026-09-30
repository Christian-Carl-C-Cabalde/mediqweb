import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MOCK_APPOINTMENTS } from '../../secretary.mock-data';
import { SecretarySession } from '../../secretary-session';
import { SecretaryDashboard } from './secretary-dashboard';

describe('SecretaryDashboard', () => {
  let fixture: ComponentFixture<SecretaryDashboard>;
  let session: SecretarySession;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SecretaryDashboard],
      // The page links into the patient and doctor routes, so a router has to
      // exist even though the test never navigates.
      providers: [SecretarySession, provideRouter([])],
    });
    session = TestBed.inject(SecretarySession);
    const today = MOCK_APPOINTMENTS.find((a) => a.startsAt.slice(0, 10) === dayKeyNow());
    session.now.set(new Date(today?.startsAt ?? MOCK_APPOINTMENTS[0].startsAt));
    fixture = TestBed.createComponent(SecretaryDashboard);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  /** `YYYY-MM-DD` for today, matching the zone-less fixture format. */
  function dayKeyNow(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  function page(): any {
    return fixture.componentInstance;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it("counts today's appointments", () => {
    expect(page().todayCount()).toBe(session.todaysAppointments().length);
  });

  it("shows today's appointments for the whole clinic, not one doctor", () => {
    // The defining claim of this screen: a Secretary's day is the clinic's day.
    // One doctor's diary would be the Doctor area's dashboard instead.
    expect(page().today().length).toBeGreaterThan(0);
    expect(
      new Set(
        page()
          .today()
          .map((a: any) => a.doctorId),
      ).size,
    ).toBeGreaterThan(1);
  });

  it('counts the bookings still waiting on a confirmation', () => {
    expect(page().awaitingCount()).toBe(
      session.appointments().filter((a) => a.status === 'booked').length,
    );
  });

  it('counts every patient on file, not just those with appointments', () => {
    expect(page().patientCount()).toBe(session.patients().length);
  });

  it('counts only the doctors taking bookings', () => {
    expect(page().doctorCount()).toBe(
      session.doctors().filter((s) => s.doctor.status === 'active').length,
    );
  });

  it("lists today's appointments by time", () => {
    const times = page()
      .today()
      .map((a: any) => a.startsAt);
    expect([...times].sort()).toEqual(times);
  });

  it('names the patient and the doctor on every row of the day list', () => {
    // The Secretary answers "is that mine, and with whom" — a time alone is not
    // enough to act on.
    for (const appointment of page().today()) {
      expect(text()).toContain(session.patientName(appointment.patientId));
      expect(text()).toContain(session.doctorName(appointment.doctorId));
    }
  });

  it("links each appointment to the patient's details", () => {
    const hrefs = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('.agenda__patient'),
    ].map((a) => a.getAttribute('href'));
    expect(hrefs.length).toBe(page().today().length);
    expect(hrefs[0]).toMatch(/^\/secretary\/patients\//);
  });

  it('offers only doctors who are taking bookings as available', () => {
    // An inactive doctor is not somewhere a patient can be sent, so listing them
    // here would invite a booking the form then refuses.
    expect(page().availableDoctors().length).toBeGreaterThan(0);
    for (const summary of page().availableDoctors()) {
      expect(summary.doctor.status).toBe('active');
    }
  });

  it('orders the available doctors by how much room is left today', () => {
    const booked = page()
      .availableDoctors()
      .map((s: any) => page().bookedToday(s));
    expect([...booked].sort((a: number, b: number) => a - b)).toEqual(booked);
  });

  it('caps the available-doctor list so the side column stays scannable', () => {
    expect(page().availableDoctors().length).toBeLessThanOrEqual(5);
  });

  it('shows the next appointment, not a past one', () => {
    const next = page().next();
    expect(next).toBe(session.nextAppointment());
    expect(new Date(next.startsAt).getTime()).toBeGreaterThanOrEqual(session.now().getTime());
    expect(text()).toContain(session.patientName(next.patientId));
  });

  it('reacts to an appointment being booked elsewhere', () => {
    const before = page().todayCount();
    const target = page().today()[0];
    session.cancel(target.id);
    fixture.detectChanges();
    expect(page().todayCount()).toBe(before - 1);
  });

  it('reacts to an appointment being cancelled elsewhere', () => {
    const before = page().awaitingCount();
    const booked = session.appointments().find((a) => a.status === 'booked')!;
    session.cancel(booked.id);
    fixture.detectChanges();
    expect(page().awaitingCount()).toBe(before - 1);
  });

  it('points at the appointment list rather than hosting a booking form', () => {
    // Booking needs a patient, a doctor, a time and a reason — a screen of its
    // own. The dashboard offers the route to it, not a cut-down version.
    const hrefs = [
      ...(fixture.nativeElement as HTMLElement).querySelectorAll('a.statFooter, a.see-all'),
    ].map((a) => a.getAttribute('href'));
    expect(hrefs).toContain('/secretary/appointments');
    expect(text()).not.toContain('Book appointment');
  });

  it('says the data is a sample, so a screenshot is not mistaken for a product', () => {
    expect(text()).toContain('Sample data');
  });
});
