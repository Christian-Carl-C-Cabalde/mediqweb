import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MOCK_APPOINTMENTS, MOCK_PATIENTS } from '../../secretary.mock-data';
import { SecretarySession } from '../../secretary-session';
import { SecretaryPatients } from './secretary-patients';

describe('SecretaryPatients', () => {
  let fixture: ComponentFixture<SecretaryPatients>;
  let session: SecretarySession;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SecretaryPatients],
      providers: [SecretarySession, provideRouter([])],
    });
    session = TestBed.inject(SecretarySession);
    fixture = TestBed.createComponent(SecretaryPatients);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function page(): any {
    return fixture.componentInstance;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  /** A patient the fixtures deliberately give no appointments. */
  function unbookedPatient(): string {
    // A patient whose appointment already happened today has `visitCount === 0`
    // and no next visit but a last visit, so all three must be checked to find
    // the one who has never been seen or booked.
    const row = page()
      .rows()
      .find((r: any) => r.visitCount === 0 && !r.nextVisitAt && !r.lastVisitAt);
    expect(row, 'no unbooked patient in the fixtures').toBeTruthy();
    return row.id;
  }

  it('lists every patient the clinic has on file', () => {
    expect(page().rows().length).toBe(MOCK_PATIENTS.length);
  });

  it('lists a patient who has never had an appointment', () => {
    // The opposite of the Doctor area, where a patient only becomes visible once
    // they have an appointment. A walk-in cannot be booked if they cannot be
    // found, which is the case this list exists for.
    const id = unbookedPatient();
    expect(session.patientById(id)).not.toBeNull();
    expect(text()).toContain(session.patientById(id)!.name);
  });

  it('shows a patient with no appointments as "Never", not as a blank cell', () => {
    const id = unbookedPatient();
    const row = page()
      .rows()
      .find((r: any) => r.id === id);
    expect(row.lastVisitAt).toBeNull();
    expect(row.nextVisitAt).toBeNull();
  });

  it('includes appointments with every doctor, not just one', () => {
    // A patient can see a cardiologist and a dermatologist; the Secretary has to
    // see the whole history to answer the phone.
    const byDoctor = new Map<string, Set<string>>();
    for (const appointment of MOCK_APPOINTMENTS) {
      const seen = byDoctor.get(appointment.patientId) ?? new Set<string>();
      seen.add(appointment.doctorId);
      byDoctor.set(appointment.patientId, seen);
    }
    const multi = [...byDoctor.values()].filter((set) => set.size > 1);
    expect(multi.length).toBeGreaterThan(0);

    const patientId = [...byDoctor.entries()].find(([, set]) => set.size > 1)![0];
    expect(
      new Set(session.appointmentsForPatient(patientId).map((a) => a.doctorId)).size,
    ).toBeGreaterThan(1);
  });

  it('counts a visit only once it has been completed or missed', () => {
    // "Visits" is a history figure. Counting a booking that is still in the
    // future would report a patient as having been seen before they arrived.
    const future = MOCK_APPOINTMENTS.find((a) => a.status === 'booked')!;
    const row = page()
      .rows()
      .find((r: any) => r.id === future.patientId);
    const expected = MOCK_APPOINTMENTS.filter(
      (a) =>
        a.patientId === future.patientId && (a.status === 'completed' || a.status === 'no-show'),
    ).length;
    expect(row.visitCount).toBe(expected);
  });

  it('filters by name', () => {
    page().query.set('juan');
    fixture.detectChanges();
    expect(page().rows().length).toBeGreaterThan(0);
    for (const row of page().rows()) {
      expect(row.name.toLowerCase()).toContain('juan');
    }
  });

  it('filters by contact number, which is what a caller usually reads out', () => {
    const patient = MOCK_PATIENTS[0];
    const digits = patient.phone.replace(/\D/g, '').slice(-4);
    page().query.set(digits);
    fixture.detectChanges();
    expect(
      page()
        .rows()
        .map((r: any) => r.id),
    ).toContain(patient.id);
  });

  it('filters by email', () => {
    page().query.set('alcaraz');
    fixture.detectChanges();
    expect(page().rows().length).toBeGreaterThan(0);
  });

  it('filters by account status', () => {
    page().statusFilter.set('inactive');
    fixture.detectChanges();
    for (const row of page().rows()) {
      expect(row.status).toBe('inactive');
    }
  });

  it('keeps an inactive patient visible, since their history still matters', () => {
    expect(MOCK_PATIENTS.some((p) => p.status === 'inactive')).toBe(true);
    expect(page().rows().length).toBe(MOCK_PATIENTS.length);
  });

  it('explains an empty result rather than showing a bare table', () => {
    page().query.set('nobody by this name');
    fixture.detectChanges();
    expect(text()).toContain('No patients match your filters');
  });

  it('agrees with itself about how many patients have something booked', () => {
    const booked = page()
      .rows()
      .filter((r: any) => r.nextVisitAt).length;
    expect(text()).toContain(`${booked} of ${MOCK_PATIENTS.length} patients`);
    // The fixture has one patient with nothing booked, so the caption must not be
    // "14 of 14" — that was the kind of off-by-one a hand-written caption hides.
    expect(booked).toBeLessThan(MOCK_PATIENTS.length);
  });

  it('links each row to that patient file', () => {
    const hrefs = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.row-identity')].map(
      (a) => a.getAttribute('href'),
    );
    expect(hrefs).toContain(`/secretary/patients/${MOCK_PATIENTS[0].id}`);
  });

  it('says registering a new patient is a later milestone', () => {
    // The absence of a "add patient" button is a scope decision, so it is stated
    // rather than left as a gap.
    expect(text()).toContain('later milestone');
  });

  it('says the data is a sample, so a screenshot is not mistaken for a product', () => {
    expect(text()).toContain('Sample data');
  });
});
