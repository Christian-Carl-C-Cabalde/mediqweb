import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MOCK_APPOINTMENTS, MOCK_DOCTORS, MOCK_SECRETARY_PROFILE } from '../../secretary.mock-data';
import { SecretarySession } from '../../secretary-session';
import { SecretaryDoctors } from './secretary-doctors';

describe('SecretaryDoctors', () => {
  /** The one doctor on this desk. */
  const DESK = MOCK_SECRETARY_PROFILE.assignedDoctorId!;

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

  it('lists the assigned doctor and nobody else from the clinic roster', () => {
    expect(page().rows().length).toBe(1);
    expect(page().rows()[0].id).toBe(DESK);
    expect(MOCK_DOCTORS.length).toBeGreaterThan(1);
  });

  it('does not name another doctor anywhere on the page', () => {
    for (const doctor of MOCK_DOCTORS.filter((d) => d.id !== DESK)) {
      expect(text()).not.toContain(doctor.name);
    }
  });

  it('drops the search and account filters that could only hide one row', () => {
    // A search box over a list of one can only find what is already on screen, and
    // an account filter can only hide the single row. Both controls are gone, and
    // their absence is worth asserting: they would look like the list was bigger
    // than it is.
    expect(page().query).toBeUndefined();
    expect(page().statusFilter).toBeUndefined();
    expect(page().onStatusFilterChange).toBeUndefined();
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('input[type="search"]')).toBeNull();
    expect(text()).not.toContain('Search doctors');
  });

  it('repeats the published hours from the store', () => {
    const summary = session.doctors()[0];
    expect(page().rows()[0].weeklyHours).toBe(summary.weeklyHours);
  });

  it('counts the days the doctor works from the published week itself', () => {
    const expected = session.scheduleFor(DESK).filter((day) => day.enabled).length;
    expect(page().rows()[0].openDays).toBe(expected);
  });

  it('counts live appointments, not the whole past diary', () => {
    // "Booked" answers "can I still reach this doctor's diary today", to which a
    // completed appointment contributes nothing.
    const now = session.now().getTime();
    const expected = session
      .appointmentsForDoctor(DESK)
      .filter(
        (a) =>
          (a.status === 'booked' || a.status === 'confirmed') &&
          new Date(a.startsAt).getTime() >= now,
      ).length;
    expect(page().rows()[0].appointmentCount).toBe(expected);
  });

  it('says the assigned doctor is taking bookings, in words rather than code', () => {
    const desk = MOCK_DOCTORS.find((d) => d.id === DESK)!;
    expect(desk.status).toBe('active');
    expect(text()).toContain('Taking bookings');
    expect(text()).not.toContain('Not taking bookings');
  });

  it('counts the desk in the table caption', () => {
    expect(text()).toContain('The doctor you are assigned to');
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

  it('links the row to the published schedule', () => {
    const hrefs = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.link-action')].map(
      (a) => a.getAttribute('href'),
    );
    expect(hrefs).toContain('/secretary/schedules');
  });

  it('says who assigns the desk, so the page does not read as a clinic roster', () => {
    // The footnote used to talk about turning a doctor off. What a Secretary
    // actually needs to know is who put them on this desk at all.
    expect(text()).toContain('An Administrator assigns you');
  });

  it('says the data is a sample, so a screenshot is not mistaken for a product', () => {
    expect(text()).toContain('Sample data');
  });
});
