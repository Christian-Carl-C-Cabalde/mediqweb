import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { localIso, minutesOfDay } from '../../secretary.dates';
import { MOCK_APPOINTMENTS, MOCK_SCHEDULES } from '../../secretary.mock-data';
import { SecretarySession } from '../../secretary-session';
import type { Appointment } from '../../secretary.models';
import { SecretaryAppointments } from './secretary-appointments';

describe('SecretaryAppointments', () => {
  let fixture: ComponentFixture<SecretaryAppointments>;
  let session: SecretarySession;

  /** A future published slot for `doc-003`, as the `date`/`time` pair. */
  function futureSlot(days = 14): { date: string; time: string } {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + days);
    for (let skip = 0; skip < 14; skip += 1) {
      if (MOCK_SCHEDULES['doc-003'][date.getDay()].enabled) break;
      date.setDate(date.getDate() + 1);
    }
    const pad = (n: number) => String(n).padStart(2, '0');
    const open = minutesOfDay(MOCK_SCHEDULES['doc-003'][date.getDay()].startTime)!;
    return {
      date: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
      time: `${pad(Math.floor(open / 60))}:${pad(open % 60)}`,
    };
  }

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SecretaryAppointments],
      // The table links into the patient routes, so a router has to exist even
      // though the test never navigates.
      providers: [SecretarySession, provideRouter([])],
    });
    session = TestBed.inject(SecretarySession);
    const today = MOCK_APPOINTMENTS.find((a) => a.startsAt.slice(0, 10) === dayKeyNow());
    session.now.set(new Date(today?.startsAt ?? MOCK_APPOINTMENTS[0].startsAt));
    fixture = TestBed.createComponent(SecretaryAppointments);
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

  function form(): any {
    return page().bookingForm;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function button(label: string): HTMLButtonElement | undefined {
    return [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === label,
    ) as HTMLButtonElement | undefined;
  }

  /**
   * The heading of whichever dialog is currently open, or `''`.
   *
   * Both modals stay in the DOM whether open or closed — a native `<dialog>` is
   * hidden with the `open` attribute, not removed — so this has to look at the
   * attribute. Checking page text instead would find "Reschedule" in a table
   * button and never notice the dialog had closed.
   */
  function openDialogTitle(): string {
    const dialog = [...(fixture.nativeElement as HTMLElement).querySelectorAll('dialog')].find(
      (d) => d.hasAttribute('open'),
    );
    return dialog?.querySelector('.ui-modal__title')?.textContent ?? '';
  }

  /** Fills the booking form with a slot the store will accept. */
  function fillValidBooking(over: Record<string, unknown> = {}): void {
    form().setValue({
      patientId: 'pat-201',
      doctorId: 'doc-003',
      ...futureSlot(),
      duration: 30,
      reason: 'Routine check-up',
      ...over,
    });
    fixture.detectChanges();
  }

  function statusOf(id: string): string | undefined {
    return session.appointments().find((a) => a.id === id)?.status;
  }

  // --- The list

  it('lists every appointment in the clinic', () => {
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

  it('filters by doctor name', () => {
    // A secretary is routinely looking for "what does Dr Lim have today", so the
    // search box has to reach the doctor as well as the patient and the reason.
    page().query.set('lim');
    fixture.detectChanges();
    expect(page().appointments().length).toBeGreaterThan(0);
    for (const appointment of page().appointments()) {
      expect(session.doctorName(appointment.doctorId).toLowerCase()).toContain('lim');
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

  it('filters by doctor', () => {
    const doctorId = page().doctorOptions()[1].id;
    page().onDoctorFilterChange({ id: doctorId, label: 'x' });
    fixture.detectChanges();
    for (const appointment of page().appointments()) {
      expect(appointment.doctorId).toBe(doctorId);
    }
  });

  it('offers every doctor as a filter, including one who is not taking bookings', () => {
    // Filtering to an inactive doctor is how the secretary finds the history of
    // somebody who has left the roster.
    expect(page().doctorOptions()[0].id).toBe('all');
    expect(page().doctorOptions().length).toBe(session.doctors().length + 1);
  });

  it('combines the search box with the filters', () => {
    page().query.set('juan');
    page().statusFilter.set('confirmed');
    fixture.detectChanges();
    expect(page().appointments().length).toBeGreaterThan(0);
    for (const appointment of page().appointments()) {
      expect(session.patientName(appointment.patientId).toLowerCase()).toContain('juan');
      expect(appointment.status).toBe('confirmed');
    }
  });

  it('explains an empty result rather than showing a bare table', () => {
    page().query.set('nobody by this name');
    fixture.detectChanges();
    expect(text()).toContain('No appointments match your filters');
  });

  it('names the patient and the doctor on every row', () => {
    for (const appointment of page().appointments()) {
      expect(page().patientName(appointment)).toBeTruthy();
      expect(page().doctorName(appointment)).toBeTruthy();
    }
  });

  // --- Booking

  it('offers only active doctors in the booking form', () => {
    // A Secretary cannot book a doctor who is not taking bookings, so offering
    // them and then refusing would waste the secretary's time.
    expect(page().bookableDoctors().length).toBeGreaterThan(0);
    for (const summary of page().bookableDoctors()) {
      expect(summary.doctor.status).toBe('active');
    }
  });

  it('says nothing is wrong with an untouched form', () => {
    // Nagging before anyone has typed would read as an error rather than a hint.
    expect(page().bookingProblem()).toBeNull();
    expect(page().bookingRefusalText()).toBeNull();
  });

  it('books a valid appointment and adds it to the list', () => {
    fillValidBooking();
    expect(page().canSubmitBooking()).toBe(true);

    const before = page().appointments().length;
    page().submitBooking();
    fixture.detectChanges();

    expect(page().appointments().length).toBe(before + 1);
    expect(text()).toContain('is booked with');
  });

  it('takes the appointment length as a number when the select is used', () => {
    // Driven through the rendered `<select>` on purpose. Setting the control
    // directly bypasses the value accessor, which is where a string sneaks in:
    // `540 + "15"` is far past closing time, so a length picked by hand made every
    // booking look impossible.
    const select = (fixture.nativeElement as HTMLElement).querySelector<HTMLSelectElement>(
      '#book-duration',
    )!;
    const slot = futureSlot();
    form().setValue({
      patientId: 'pat-201',
      doctorId: 'doc-003',
      ...slot,
      duration: 30,
      reason: 'Routine check-up',
    });

    // With `[ngValue]` an option's `value` is an accessor-generated id, so the
    // option is chosen the way a person does — by what it says.
    const option = [...select.options].find((o) => o.textContent?.trim().startsWith('15 '))!;
    option.selected = true;
    select.value = option.value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(form().getRawValue().duration).toBe(15);
    expect(typeof form().getRawValue().duration).toBe('number');
    expect(page().bookingProblem()).toBeNull();
    expect(page().canSubmitBooking()).toBe(true);
  });

  it('books a new appointment as "booked" rather than confirmed', () => {
    fillValidBooking();
    page().submitBooking();
    fixture.detectChanges();

    const latest = session.appointments().at(-1)!;
    expect(latest.status).toBe('booked');
  });

  it('clears the form after booking, ready for the next walk-in', () => {
    fillValidBooking();
    page().submitBooking();
    fixture.detectChanges();

    expect(form().getRawValue().patientId).toBe('');
    expect(form().getRawValue().reason).toBe('');
  });

  it('refuses a booking that clashes with the doctor, and says why', () => {
    const existing = session
      .appointments()
      .find((a) => a.status === 'booked' || a.status === 'confirmed')!;
    const at = new Date(existing.startsAt);

    fillValidBooking({
      doctorId: existing.doctorId,
      date: `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`,
      time: `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`,
    });

    expect(page().bookingProblem()).toBe('doctor-busy');
    expect(page().bookingRefusalText()).toBe('The doctor already has an appointment at that time.');
    expect(page().canSubmitBooking()).toBe(false);
  });

  it('refuses a booking on a day the doctor does not work', () => {
    const closed = new Date();
    while (MOCK_SCHEDULES['doc-003'][closed.getDay()].enabled) {
      closed.setDate(closed.getDate() + 1);
    }
    fillValidBooking({
      date: `${closed.getFullYear()}-${String(closed.getMonth() + 1).padStart(2, '0')}-${String(closed.getDate()).padStart(2, '0')}`,
    });
    expect(page().bookingProblem()).toBe('day-closed');
    expect(page().canSubmitBooking()).toBe(false);
  });

  it('refuses a booking for an inactive doctor', () => {
    const inactive = session.doctors().find((s) => s.doctor.status !== 'active')!;
    fillValidBooking({ doctorId: inactive.doctor.id });
    expect(page().bookingProblem()).toBe('inactive-doctor');
  });

  it('refuses a booking in the past', () => {
    fillValidBooking({ date: '2020-01-01', time: '09:00' });
    expect(page().bookingProblem()).toBe('not-in-the-future');
  });

  it('will not submit an incomplete form', () => {
    form().setValue({ patientId: '', doctorId: '', date: '', time: '', duration: 30, reason: '' });
    fixture.detectChanges();
    expect(page().canSubmitBooking()).toBe(false);

    const before = session.appointments().length;
    page().submitBooking();
    expect(session.appointments().length).toBe(before);
  });

  it('marks the fields it wants once they have been touched', () => {
    form().controls.reason.markAsTouched();
    form().controls.reason.setValue('ab');
    fixture.detectChanges();

    expect(page().reasonError()).toBe('Use at least 3 characters.');
    expect(text()).toContain('Use at least 3 characters');
  });

  it('does not blame the secretary for a field they have not touched yet', () => {
    form().patchValue({ reason: '' });
    fixture.detectChanges();
    expect(page().reasonError()).toBeNull();
  });

  it('disables the submit button while the booking is refused', () => {
    fillValidBooking({ date: '2020-01-01' });
    const submit = button('Book appointment');
    expect(submit?.disabled).toBe(true);
  });

  // --- Rescheduling

  it('opens the reschedule form pre-filled with the appointment own time', () => {
    const live: Appointment = session
      .appointments()
      .find((a) => a.status === 'booked' || a.status === 'confirmed')!;
    page().openReschedule(live);
    fixture.detectChanges();

    const at = new Date(live.startsAt);
    expect(page().rescheduleForm.getRawValue().time).toBe(
      `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`,
    );
    expect(openDialogTitle()).toContain('Reschedule appointment');
  });

  it('treats an unchanged time as a valid move rather than a clash with itself', () => {
    const live = session
      .appointments()
      .find((a) => a.status === 'booked' || a.status === 'confirmed')!;
    page().openReschedule(live);
    fixture.detectChanges();

    expect(page().rescheduleProblem()).toBeNull();
    expect(page().submitReschedule()).toBeUndefined();
    expect(statusOf(live.id)).not.toBe('cancelled');
  });

  it('moves an appointment to a new free slot', () => {
    // `futureSlot` produces a doc-003 window, so the appointment being moved has
    // to be a doc-003 one — moving another doctor's on to 09:00 would trip the
    // hours rule and fail for the wrong reason.
    const live = session
      .appointments()
      .find((a) => a.status === 'booked' && a.doctorId === 'doc-003')!;
    const slot = futureSlot(21);
    page().openReschedule(live);
    page().rescheduleForm.setValue(slot);
    fixture.detectChanges();

    page().submitReschedule();
    fixture.detectChanges();

    const moved = session.appointments().find((a) => a.id === live.id)!;
    expect(moved.startsAt.startsWith(slot.date)).toBe(true);
    expect(text()).toContain('is moved to the new time');
  });

  it('confirms a move with the new time, not the one it came from', () => {
    // The store replaces the appointment with a new object, so a confirmation
    // built from the pre-move one reads "moved to the new time" beside the old
    // time. Pin the timestamp in the notice.
    const live = session
      .appointments()
      .find((a) => a.status === 'booked' && a.doctorId === 'doc-003')!;
    const slot = futureSlot(21);

    page().openReschedule(live);
    page().rescheduleForm.setValue(slot);
    fixture.detectChanges();
    page().submitReschedule();
    fixture.detectChanges();

    const notice = (fixture.nativeElement as HTMLElement).querySelector('.row-notice')!;
    const when = notice.querySelector('.row-notice__when')!.textContent!.trim();
    const moved = session.appointments().find((a) => a.id === live.id)!;
    const at = new Date(moved.startsAt);

    // Same shape the template renders: `MMM d · h:mm a`.
    const expected = [
      at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
    ].join(' · ');
    expect(when).toBe(expected);
    // And it is not the time the appointment came from.
    expect(when).not.toBe(
      [
        new Date(live.startsAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        new Date(live.startsAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }),
      ].join(' · '),
    );
  });

  it('explains a reschedule into a busy slot instead of moving it', () => {
    const live = session
      .appointments()
      .find((a) => a.status === 'booked' && a.doctorId === 'doc-003')!;
    const other = session
      .appointments()
      .filter(
        (a) =>
          a.id !== live.id &&
          a.doctorId === 'doc-003' &&
          (a.status === 'booked' || a.status === 'confirmed'),
      )[0];
    const at = new Date(other.startsAt);

    page().openReschedule(live);
    page().rescheduleForm.setValue({
      date: `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`,
      time: `${String(at.getHours()).padStart(2, '0')}:${String(at.getMinutes()).padStart(2, '0')}`,
    });
    fixture.detectChanges();

    expect(page().rescheduleProblem()).toBe('doctor-busy');
    expect(text()).toContain('already has an appointment');
    expect(session.appointments().find((a) => a.id === live.id)!.startsAt).toBe(live.startsAt);
  });

  it('closes the reschedule form without changing anything', () => {
    const live = session.appointments().find((a) => a.status === 'booked')!;
    page().openReschedule(live);
    fixture.detectChanges();
    expect(openDialogTitle()).toContain('Reschedule appointment');

    page().closeReschedule();
    fixture.detectChanges();

    expect(openDialogTitle()).not.toContain('Reschedule');
    expect(session.appointments().find((a) => a.id === live.id)!.startsAt).toBe(live.startsAt);
  });

  it('has no reschedule problem to report when nothing is open', () => {
    expect(page().rescheduleProblem()).toBeNull();
  });

  // --- Cancelling

  it('offers reschedule and cancel only while the patient is still expected', () => {
    for (const status of ['booked', 'confirmed'] as const) {
      expect(page().canAct({ status } as Appointment)).toBe(true);
    }
    for (const status of ['completed', 'cancelled', 'no-show'] as const) {
      expect(page().canAct({ status } as Appointment)).toBe(false);
    }
  });

  it('asks before cancelling, and cancelling does not happen on its own', () => {
    const live = session.appointments().find((a) => a.status === 'confirmed')!;
    page().requestCancel(live);
    fixture.detectChanges();

    expect(statusOf(live.id)).toBe('confirmed');
    expect(openDialogTitle()).toContain('Cancel appointment');
  });

  it('cancels only once confirmed', () => {
    const live = session.appointments().find((a) => a.status === 'confirmed')!;
    page().requestCancel(live);
    page().confirmCancel();
    fixture.detectChanges();
    expect(statusOf(live.id)).toBe('cancelled');
  });

  it('keeps the row after cancelling, rather than deleting the history', () => {
    const live = session.appointments().find((a) => a.status === 'confirmed')!;
    const before = page().appointments().length;
    page().requestCancel(live);
    page().confirmCancel();
    fixture.detectChanges();
    expect(page().appointments().length).toBe(before);
  });

  it('dismisses the confirmation message', () => {
    const live = session.appointments().find((a) => a.status === 'confirmed')!;
    page().requestCancel(live);
    page().confirmCancel();
    fixture.detectChanges();
    expect(text()).toContain('is cancelled');

    button('Dismiss')?.click();
    fixture.detectChanges();
    expect(text()).not.toContain('is cancelled');
  });

  it('offers no action at all on a completed appointment', () => {
    const done = session.appointments().find((a) => a.status === 'completed')!;
    expect(page().canAct(done)).toBe(false);
  });

  // --- Division of labour

  it("does not offer the doctor's decisions, and says who makes them", () => {
    // Confirming, completing and recording a no-show are clinical decisions. If
    // this screen offered them, the area would be claiming a scope it does not
    // have and two people could act on the same appointment.
    expect(text()).not.toContain('Mark no-show');
    expect(text()).not.toContain('Complete');
    expect(text()).toContain("are the doctor's to do");
  });

  it('says the data is a sample, so a screenshot is not mistaken for a product', () => {
    expect(text()).toContain('Sample data');
  });
});
