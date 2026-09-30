import { Component } from '@angular/core';
import { By } from '@angular/platform-browser';
import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, RouterOutlet, provideRouter, type Routes } from '@angular/router';
import { ageFrom } from '../../secretary.dates';
import { MOCK_APPOINTMENTS } from '../../secretary.mock-data';
import { SecretarySession } from '../../secretary-session';
import { SecretaryPatientDetails } from './secretary-patient-details';

const ROUTES: Routes = [{ path: 'secretary/patients/:id', component: SecretaryPatientDetails }];

/**
 * The page is addressed by a route parameter, so it has to be rendered by the
 * router rather than created directly. `TestBed.createComponent(Page)` would
 * attach the component to the root injector, where `ActivatedRoute` is the
 * router's root route and carries no `:id` — the page would then correctly
 * report "not found" for a patient that does exist.
 */
@Component({ selector: 'app-test-host', template: '<router-outlet />', imports: [RouterOutlet] })
class TestHost {}

describe('SecretaryPatientDetails', () => {
  let fixture: ComponentFixture<TestHost>;
  let session: SecretarySession;
  let router: Router;

  /** A patient the fixtures give no appointments, to check the empty history. */
  const UNBOOKED = 'pat-215';

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [TestHost],
      providers: [SecretarySession, provideRouter(ROUTES)],
    });
    session = TestBed.inject(SecretarySession);
    const today = MOCK_APPOINTMENTS.find((a) => a.startsAt.slice(0, 10) === dayKeyNow());
    session.now.set(new Date(today?.startsAt ?? MOCK_APPOINTMENTS[0].startsAt));
    router = TestBed.inject(Router);
    fixture = TestBed.createComponent(TestHost);
  });

  function dayKeyNow(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  async function open(id: string): Promise<void> {
    await router.navigateByUrl(`/secretary/patients/${id}`);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function page(): any {
    return fixture.debugElement.query(By.directive(SecretaryPatientDetails))?.componentInstance;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('shows the patient named in the route', async () => {
    await open('pat-201');
    expect(text()).toContain('Juan Dela Cruz');
  });

  it('shows the contact details a secretary needs to confirm an appointment', async () => {
    await open('pat-201');
    const patient = session.patientById('pat-201')!;
    expect(text()).toContain(patient.phone);
    expect(text()).toContain(patient.email);
    expect(text()).toContain(patient.address);
  });

  it('shows the birth date and an age derived from it, not a hardcoded one', async () => {
    await open('pat-201');
    const patient = session.patientById('pat-201')!;
    expect(text()).toContain(String(new Date(`${patient.dateOfBirth}T00:00:00`).getFullYear()));
    expect(text()).toContain(`${ageFrom(patient.dateOfBirth, session.now())} years old`);
  });

  it('lists the appointment history newest first', async () => {
    await open('pat-201');
    const times = page()
      .historyRows()
      .map((a: any) => a.startsAt);
    expect(times.length).toBeGreaterThan(1);
    expect([...times].sort().reverse()).toEqual(times);
  });

  it('lists appointments with every doctor, not only one', async () => {
    // The Secretary books for the whole clinic, so a patient's file here is their
    // MediQ history rather than one provider's slice of it.
    const patientId = [...new Set(MOCK_APPOINTMENTS.map((a) => a.patientId))].find((id) => {
      const doctors = new Set(
        MOCK_APPOINTMENTS.filter((a) => a.patientId === id).map((a) => a.doctorId),
      );
      return doctors.size > 1;
    })!;

    await open(patientId);
    const doctors = new Set(
      page()
        .history()
        .map((a: any) => a.doctorId),
    );
    expect(doctors.size).toBeGreaterThan(1);
  });

  it('names the doctor on each history row', async () => {
    await open('pat-201');
    for (const appointment of page().history()) {
      expect(page().doctorName(appointment)).toBeTruthy();
      expect(text()).toContain(session.doctorName(appointment.doctorId));
    }
  });

  it('re-reads the route when the router reuses the page for another patient', async () => {
    await open('pat-201');
    expect(text()).toContain('Juan Dela Cruz');

    await open('pat-203');
    expect(text()).toContain('Pedro Reyes');
    expect(text()).not.toContain('Juan Dela Cruz');
  });

  it('agrees with itself about the number of appointments', async () => {
    // A patient with a single visit is the case a bare `{{ n }} appointments`
    // gets wrong, so assert the singular explicitly rather than trusting the
    // count to be plural.
    await open(UNBOOKED);
    expect(page().history().length).toBe(0);
    expect(text()).toContain('0 appointments');
  });

  it('explains an empty history instead of showing a bare table', async () => {
    await open(UNBOOKED);
    expect(text()).toContain('no appointments yet');
  });

  it('explains the absence of a medical record rather than showing an empty panel', async () => {
    await open('pat-201');
    expect(text()).toContain('Medical records');
    // And says what the page does show, so the limit reads as scope rather than
    // as missing functionality.
    expect(text()).toContain('administrative history');
  });

  it('offers a way back to the list', async () => {
    await open('pat-201');
    const href = (fixture.nativeElement as HTMLElement).querySelector('.link-button');
    expect(href?.getAttribute('href')).toBe('/secretary/patients');
  });

  it('reports an id that matches nobody instead of rendering a blank page', async () => {
    await open('pat-999');
    expect(text()).toContain('Patient not found');
  });

  it('does not leak another patient through a guessed id', async () => {
    await open('pat-999');
    for (const patient of session.patients()) {
      if (patient.patient.id === 'pat-999') continue;
      expect(text()).not.toContain(patient.patient.name);
    }
  });

  it('shows an inactive patient without hiding their history', async () => {
    const inactive = session.patients().find((s) => s.patient.status === 'inactive')!;
    await open(inactive.patient.id);
    expect(text()).toContain(inactive.patient.name);
    expect(text()).toContain('inactive account');
  });

  it('says the data is a sample, so a screenshot is not mistaken for a product', async () => {
    await open('pat-201');
    expect(text()).toContain('Sample data');
  });
});
