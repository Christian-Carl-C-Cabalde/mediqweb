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

  it('breaks the rendered list down by severity, totalling the same rows', () => {
    const slices = page().severitySlices();
    const total = slices.reduce((sum: number, slice: any) => sum + slice.value, 0);
    expect(total).toBe(page().activity().length);
    expect(slices.length).toBeGreaterThan(0);
  });

  it('counts every severity present exactly once', () => {
    const severities = new Set(page().activity().map((entry: any) => entry.severity));
    expect(page().severitySlices()).toHaveLength(severities.size);
  });

  it('names each slice the way the audit log page does', () => {
    const labels: string[] = page().severitySlices().map((slice: any) => slice.label);
    for (const label of labels) {
      expect(['Routine', 'Needs attention', 'Problem']).toContain(label);
    }
  });

  it('draws the breakdown beside the list, not instead of it', () => {
    const host = fixture.nativeElement as HTMLElement;
    expect(host.querySelector('.activity-split .activity')).toBeTruthy();
    expect(host.querySelector('.activity-split ui-pie-chart')).toBeTruthy();
    expect(
      host.querySelectorAll('ui-pie-chart .pie__item').length,
    ).toBe(page().severitySlices().length);
  });

  it('states plainly that the data is a sample', () => {
    expect(text()).toContain('Sample data.');
  });
});
