import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MOCK_APPOINTMENTS, MOCK_DOCTORS } from '../../secretary.mock-data';
import { SecretarySession } from '../../secretary-session';
import { SecretaryDoctors } from './secretary-doctors';

describe('SecretaryDoctors', () => {
  let fixture: ComponentFixture<SecretaryDoctors>;
  let session: SecretarySession;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SecretaryDoctors],
      // The table links into the schedules route, so a router has to exist even
      // though the test never navigates.
      providers: [SecretarySession, provideRouter([])],
    });
    session = TestBed.inject(SecretarySession);
    const today = MOCK_APPOINTMENTS.find((a) => a.startsAt.slice(0, 10) === dayKeyNow());
    session.now.set(new Date(today?.startsAt ?? MOCK_APPOINTMENTS[0].startsAt));
    fixture = TestBed.createComponent(SecretaryDoctors);
    fixture.detectChanges();
    await fixture.whenStable();
  });

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

  it('lists every doctor on the clinic roster', () => {
    expect(page().rows().length).toBe(MOCK_DOCTORS.length);
  });

  it('keeps an inactive doctor visible, because past bookings still matter', () => {
    // The Secretary books for the whole roster; a doctor who has stopped taking
    // bookings still has a history to be asked about at the front desk.
    const inactive = MOCK_DOCTORS.find((d) => d.status === 'inactive')!;
    expect(text()).toContain(inactive.name);
  });

  it("repeats the doctor's published hours from the store", () => {
    for (const summary of session.doctors()) {
      const row = page()
        .rows()
        .find((r: any) => r.id === summary.doctor.id);
      expect(row.weeklyHours).toBe(summary.weeklyHours);
    }
  });

  it('counts the days a doctor works from the published week itself', () => {
    for (const doctor of MOCK_DOCTORS) {
      const row = page()
        .rows()
        .find((r: any) => r.id === doctor.id);
      const expected = session.scheduleFor(doctor.id).filter((day) => day.enabled).length;
      expect(row.openDays).toBe(expected);
    }
  });

  it('counts live appointments, not the whole past diary', () => {
    // "Booked" answers "can I still reach this doctor's diary today", to which a
    // completed appointment contributes nothing.
    const now = session.now().getTime();
    for (const doctor of MOCK_DOCTORS) {
      const row = page()
        .rows()
        .find((r: any) => r.id === doctor.id);
      const expected = session
        .appointmentsForDoctor(doctor.id)
        .filter(
          (a) =>
            (a.status === 'booked' || a.status === 'confirmed') &&
            new Date(a.startsAt).getTime() >= now,
        ).length;
      expect(row.appointmentCount).toBe(expected);
    }
  });

  it('counts zero live appointments for the doctor who is not taking bookings', () => {
    const inactive = MOCK_DOCTORS.find((d) => d.status === 'inactive')!;
    const row = page()
      .rows()
      .find((r: any) => r.id === inactive.id);
    expect(row.appointmentCount).toBe(0);
    expect(row.nextAvailableAt).toBeNull();
    expect(text()).toContain('Nothing booked');
  });

  it('filters by name', () => {
    page().query.set('ana');
    fixture.detectChanges();
    expect(page().rows().length).toBeGreaterThan(0);
    for (const row of page().rows()) {
      expect(row.name.toLowerCase()).toContain('ana');
    }
  });

  it('filters by specialization', () => {
    page().query.set('cardiology');
    fixture.detectChanges();
    expect(page().rows().length).toBe(1);
    expect(page().rows()[0].specialization).toBe('Cardiology');
  });

  it('filters by email', () => {
    page().query.set('navarro');
    fixture.detectChanges();
    expect(page().rows().length).toBe(1);
    expect(page().rows()[0].id).toBe('doc-003');
  });

  it('filters by account status', () => {
    page().statusFilter.set('inactive');
    fixture.detectChanges();
    const rows = page().rows();
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.status).toBe('inactive');
  });

  it('says a doctor who is not taking bookings in words, not in code', () => {
    const inactive = MOCK_DOCTORS.find((d) => d.status === 'inactive')!;
    page().query.set(inactive.name);
    fixture.detectChanges();
    expect(text()).toContain('Not taking bookings');
  });

  it('explains an empty result rather than showing a bare table', () => {
    page().query.set('nobody by this name');
    fixture.detectChanges();
    expect(text()).toContain('No doctors match your filters');
  });

  it('counts the roster in the table caption', () => {
    expect(text()).toContain(`${MOCK_DOCTORS.length} doctors on the clinic roster`);
  });

  it('gives every sort column a primitive to sort on', () => {
    // `ui-table` compares the raw value; an object here would sort as
    // "[object Object]" and silently never reorder.
    for (const row of page().rows()) {
      expect(typeof row.name).toBe('string');
      expect(typeof row.specialization).toBe('string');
      expect(typeof row.weeklyHours).toBe('string');
      expect(typeof row.openDays).toBe('number');
      expect(typeof row.appointmentCount).toBe('number');
      expect(row.nextAvailableAt === null || typeof row.nextAvailableAt === 'string').toBe(true);
      expect(typeof row.status).toBe('string');
    }
  });

  it('links each row to the published schedule', () => {
    const hrefs = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.link-action')].map(
      (a) => a.getAttribute('href'),
    );
    expect(hrefs).toContain('/secretary/schedules');
  });

  it('leaves the roster status to the Administrator, and says so', () => {
    // A Secretary books inside a doctor's hours; stopping a doctor taking
    // bookings is an account decision, not a diary one.
    expect(text()).toContain("an Administrator's action, not a Secretary's");
  });

  it('says the data is a sample, so a screenshot is not mistaken for a product', () => {
    expect(text()).toContain('Sample data');
  });
});
