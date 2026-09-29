import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AdminSession } from '../../admin-session';
import { AdminDashboard } from './admin-dashboard';

describe('AdminDashboard', () => {
  let fixture: ComponentFixture<AdminDashboard>;
  let session: AdminSession;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [AdminDashboard],
      providers: [AdminSession, provideRouter([])],
    });
    session = TestBed.inject(AdminSession);
    fixture = TestBed.createComponent(AdminDashboard);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function page(): any {
    return fixture.componentInstance;
  }

  it('shows a card for each area of the Admin', () => {
    for (const label of ['Doctors', 'Secretaries', 'Patients', 'Specializations']) {
      expect(text()).toContain(label);
    }
  });

  it('reports active counts, not totals', () => {
    expect(page().doctors()).toBe(session.activeDoctorCount());
    expect(page().patients()).toBe(session.activePatientCount());
    expect(page().secretaries()).toBe(session.activeSecretaryCount());
  });

  it('counts every specialization, active or not', () => {
    // A specialty has no status, so a total is the only honest figure.
    expect(page().specializations()).toBe(session.specializations().length);
  });

  it('lists recent activity, capped', () => {
    const rows = page().activity();
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(6);
  });

  it('reflects an account disabled elsewhere in the area', () => {
    const before = page().patients();
    const active = session.patients().find((p) => p.status === 'active')!;
    session.setPatientStatus(active.id, 'inactive');
    fixture.detectChanges();
    expect(page().patients()).toBe(before - 1);
  });

  it('surfaces a new action in the activity list', () => {
    session.addSpecialization('Neurology', 'Brain and nerves.');
    fixture.detectChanges();
    expect(text()).toContain('Added specialization');
  });

  it('labels each severity in words', () => {
    expect(page().severityTone('danger')).toBe('danger');
    expect(page().severityTone('warning')).toBe('warning');
    expect(page().severityTone('info')).toBe('info');
  });

  it('states plainly that the data is a sample', () => {
    expect(text()).toContain('Sample data.');
  });
});
