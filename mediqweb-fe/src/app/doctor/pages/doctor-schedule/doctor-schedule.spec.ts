import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { clearToasts, latestToast } from '../../../core/services/toast.service.spec-helpers';
import { DoctorSession } from '../../doctor-session';
import { DoctorSchedule } from './doctor-schedule';

describe('DoctorSchedule', () => {
  let fixture: ComponentFixture<DoctorSchedule>;
  let session: DoctorSession;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [DoctorSchedule], providers: [DoctorSession] });
    session = TestBed.inject(DoctorSession);
    fixture = TestBed.createComponent(DoctorSchedule);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  // Disarms the dismissal timers the toasts arm, so nothing is left pending.
  afterEach(() => clearToasts());

  function page(): any {
    return fixture.componentInstance;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function setTime(index: number, part: 'startTime' | 'endTime', value: string): void {
    page().row(index).get(part).setValue(value);
    fixture.detectChanges();
  }

  function setOpen(index: number, open: boolean): void {
    page().row(index).get('enabled').setValue(open);
    fixture.detectChanges();
  }

  it('offers a row for each day of the week', () => {
    expect(page().row(0)).toBeTruthy();
    expect(page().days.controls.length).toBe(7);
    expect(text()).toContain('Sunday');
    expect(text()).toContain('Saturday');
  });

  it('starts from the published week', () => {
    const monday = session.schedule().find((d) => d.dayOfWeek === 1)!;
    expect(page().row(1).get('enabled').value).toBe(monday.enabled);
    expect(page().row(1).get('startTime').value).toBe(monday.startTime);
    expect(page().row(1).get('endTime').value).toBe(monday.endTime);
  });

  it("keeps a closed day's hours in the published week", () => {
    // Sunday is closed in the fixture but still carries hours. Disabling its
    // controls must not erase them on the way back to the store.
    const sunday = session.schedule().find((d) => d.dayOfWeek === 0)!;
    expect(sunday.enabled).toBe(false);
    expect(page().row(0).get('startTime').value).toBe(sunday.startTime);
    expect(page().row(0).get('endTime').value).toBe(sunday.endTime);
  });

  it('shows the published total beside the form', () => {
    expect(text()).toContain('Published now');
    expect(page().published()).toContain('a week');
  });

  it('recalculates the draft total as the form changes', () => {
    const before = page().draftSummary();
    setOpen(6, false);
    expect(page().draftSummary()).not.toBe(before);
  });

  it('saves a changed week', () => {
    setTime(1, 'startTime', '08:00');
    setTime(1, 'endTime', '11:00');
    page().save();
    fixture.detectChanges();

    const monday = session.schedule().find((d) => d.dayOfWeek === 1)!;
    expect(monday.startTime).toBe('08:00');
    expect(monday.endTime).toBe('11:00');
    expect(latestToast()?.tone).toBe('success');
    // The summary is days and hours, not the individual start times.
    expect(latestToast()?.message).toContain('You now publish');
    // And it says the store is a fixture rather than claiming it persisted.
    expect(latestToast()?.message).toContain('this session only');
  });

  it('rejects an end time that is not after the start', () => {
    setTime(1, 'startTime', '15:00');
    setTime(1, 'endTime', '09:00');
    page().save();
    fixture.detectChanges();

    expect(page().form.invalid).toBe(true);
    // A warning, not a success or an error: nothing was attempted and the store
    // was never reached. The per-day messages name which rows.
    expect(latestToast()?.tone).toBe('warning');
    expect(latestToast()?.title).toContain('Nothing saved');
  });

  it('shows the error on a day that was touched, not before', () => {
    setTime(1, 'startTime', '15:00');
    setTime(1, 'endTime', '09:00');
    expect(page().showTimeError(1)).toBe(false);

    page().save();
    fixture.detectChanges();
    expect(page().showTimeError(1)).toBe(true);
  });

  it('does not validate the hours of a closed day', () => {
    setOpen(0, false);
    expect(page().row(0).valid).toBe(true);

    page().save();
    expect(session.schedule().find((d) => d.dayOfWeek === 0)!.enabled).toBe(false);
  });

  it("actually disables a closed day's inputs rather than only dimming them", () => {
    // A `[disabled]` attribute bound to a reactive form input is read once, so
    // toggling a day would otherwise leave the inputs editable while looking
    // closed — and still validating.
    expect(page().row(0).get('startTime').disabled).toBe(true);

    setOpen(0, true);
    expect(page().row(0).get('startTime').disabled).toBe(false);
    expect(page().row(0).get('endTime').disabled).toBe(false);

    setOpen(0, false);
    expect(page().row(0).get('startTime').disabled).toBe(true);
  });

  it('re-enabling a closed day brings its hours back', () => {
    const start = page().row(0).get('startTime').value;
    const end = page().row(0).get('endTime').value;
    setOpen(0, true);
    expect(page().row(0).get('startTime').value).toBe(start);
    expect(page().row(0).get('endTime').value).toBe(end);
  });

  it('saving a week keeps the hours of a day that was closed', () => {
    const sunday = session.schedule().find((d) => d.dayOfWeek === 0)!;
    page().save();
    fixture.detectChanges();
    const saved = session.schedule().find((d) => d.dayOfWeek === 0)!;
    expect(saved.enabled).toBe(false);
    expect(saved.startTime).toBe(sunday.startTime);
    expect(saved.endTime).toBe(sunday.endTime);
  });

  it('ignores an invalid day in the draft total rather than counting it backwards', () => {
    const before = page().draftSummary();
    setTime(1, 'startTime', '15:00');
    setTime(1, 'endTime', '09:00');
    // Monday drops out of the total instead of contributing a negative.
    expect(page().draftSummary()).not.toContain('-');
    expect(page().draftSummary()).not.toBe(before);
  });

  it('restores the published week on reset', () => {
    setTime(1, 'startTime', '08:00');
    page().reset();
    fixture.detectChanges();

    const monday = session.schedule().find((d) => d.dayOfWeek === 1)!;
    expect(page().row(1).get('startTime').value).toBe(monday.startTime);
  });

  it('restores the disabled state of a closed day on reset', () => {
    setOpen(0, true);
    expect(page().row(0).get('startTime').disabled).toBe(false);

    page().reset();
    fixture.detectChanges();
    expect(page().row(0).get('startTime').disabled).toBe(true);
  });

  it('discards an unsaved edit without touching the published week', () => {
    setTime(1, 'endTime', '23:00');
    page().reset();
    expect(session.schedule().find((d) => d.dayOfWeek === 1)!.endTime).not.toBe('23:00');
  });

  it('says the change is not persisted', () => {
    expect(text()).toContain('Sample data');
  });

  it('warns that moving a day does not move its bookings', () => {
    expect(text()).toContain('does not move the appointments already booked');
  });
});
