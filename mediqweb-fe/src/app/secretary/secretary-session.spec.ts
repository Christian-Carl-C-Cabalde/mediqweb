import { TestBed } from '@angular/core/testing';
import { dayKey, localIso, minutesOfDay } from './secretary.dates';
import {
  MOCK_APPOINTMENTS,
  MOCK_CONVERSATIONS,
  MOCK_DOCTORS,
  MOCK_PATIENTS,
  MOCK_SCHEDULES,
  MOCK_SECRETARY_PROFILE,
} from './secretary.mock-data';
import type { Appointment } from './secretary.models';
import { SecretarySession } from './secretary-session';

/** The doctor the signed-in sample Secretary is assigned to. */
const DESK = MOCK_SECRETARY_PROFILE.assignedDoctorId!;

/** A patient on that doctor's panel, so booking tests are not refused on the patient. */
const DESK_PATIENT = MOCK_PATIENTS.find((p) => p.doctorId === DESK)!.id;

/**
 * Pins the session clock to the first *today* fixture, so the day-scoped
 * computeds are deterministic. The fixtures are relative to the day the module
 * was imported, which is what keeps the dashboard populated without a clock —
 * so the test moves to a known appointment rather than asserting absolute dates.
 */
function pinToToday(session: SecretarySession): void {
  const today = MOCK_APPOINTMENTS.find((a) => a.startsAt.slice(0, 10) === dayKey(new Date()));
  session.now.set(new Date(today?.startsAt ?? MOCK_APPOINTMENTS[0].startsAt));
}

/**
 * Puts the session on a different doctor's desk.
 *
 * The fixtures are module constants and the assignment is a fact about the signed-in
 * user, so there is no seam for handing the store another profile — and without one
 * the two desks the sample does not cover could not be exercised at all: a desk with
 * no doctor, a desk whose doctor is disabled, and a desk that can reach its doctor's
 * message thread. This reaches the state the way the API would set it, which is the
 * one thing worth testing it through.
 */
function assignTo(session: SecretarySession, doctorId: string | null): void {
  (session as any).profileState.update((profile: typeof MOCK_SECRETARY_PROFILE) => ({
    ...profile,
    assignedDoctorId: doctorId,
  }));
}

/** A future local timestamp `days` out at `hour`, for booking tests. */
function futureAt(days: number, hour: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return localIso(date);
}

/**
 * The first published slot for `doctorId` at least `days` out, as a `Date`.
 *
 * The booking rules are all relative to a doctor's own week, so a test cannot
 * pick a date and hope it lands on a day that doctor works: `days + 1` is a
 * different weekday depending on when the suite runs. Asking the fixtures where
 * the doctor is actually open keeps every booking test independent of today's
 * date, which is the same reasoning behind the `atOpen` helper in the fixtures.
 */
function nextOpenDay(doctorId: string, days: number, minutesAfterOpen = 0): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);

  for (let skip = 0; skip < 14; skip += 1) {
    const day = MOCK_SCHEDULES[doctorId][date.getDay()];
    if (day.enabled) {
      const opensAt = minutesOfDay(day.startTime) ?? 0;
      const minutes = opensAt + minutesAfterOpen;
      date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
      return date;
    }
    date.setDate(date.getDate() + 1);
  }
  throw new Error(`${doctorId} has no published day within a fortnight`);
}

/**
 * A free half-hour slot published by the assigned doctor today.
 *
 * Only the assigned doctor: another doctor's slot is refused as `not-your-doctor`
 * before the clash check is reached, so probing the roster would hand back a slot
 * the store then refuses to book.
 */
function freeSlotToday(session: SecretarySession): { doctorId: string; at: Date } {
  const today = new Date().getDay();
  const day = MOCK_SCHEDULES[DESK][today];
  expect(day.enabled, 'the assigned doctor does not work today').toBe(true);

  const opensAt = minutesOfDay(day.startTime)!;
  const closesAt = minutesOfDay(day.endTime)!;

  for (let offset = 0; offset + 30 <= closesAt - opensAt; offset += 30) {
    const at = new Date();
    const minutes = opensAt + offset;
    at.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
    if (
      session.bookingRefusal({
        patientId: DESK_PATIENT,
        doctorId: DESK,
        startsAt: localIso(at),
        durationMinutes: 30,
        reason: 'Slot probe',
      }) === 'doctor-busy'
    ) {
      continue;
    }
    return { doctorId: DESK, at };
  }

  throw new Error('no free half-hour slot is published today');
}

describe('SecretarySession', () => {
  let session: SecretarySession;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [SecretarySession] });
    session = TestBed.inject(SecretarySession);
    pinToToday(session);
  });

  describe('the assigned desk', () => {
    it('shows only the assigned doctor appointments, not the clinic them', () => {
      // The scoping rule everything else rests on. The fixtures stay clinic-wide
      // precisely so this can be checked: if they were scoped too, the assertion
      // would pass without anything having filtered anything.
      const onDesk = MOCK_APPOINTMENTS.filter((a) => a.doctorId === DESK);
      expect(session.appointments().length).toBe(onDesk.length);
      expect(session.appointments().length).toBeLessThan(MOCK_APPOINTMENTS.length);
      expect(new Set(session.appointments().map((a) => a.doctorId))).toEqual(new Set([DESK]));
    });

    it('shows only the assigned doctor patients, including one with no appointments', () => {
      // A walk-in has to be bookable before they have any history, so membership
      // comes from the patient's panel rather than from a visit they have not had.
      const onDesk = MOCK_PATIENTS.filter((p) => p.doctorId === DESK);
      expect(session.patients().length).toBe(onDesk.length);
      expect(session.patients().length).toBeLessThan(MOCK_PATIENTS.length);

      const unbooked = onDesk.filter((p) => !MOCK_APPOINTMENTS.some((a) => a.patientId === p.id));
      expect(unbooked.length).toBeGreaterThan(0);
      expect(session.patients().some((s) => s.patient.id === unbooked[0].id)).toBe(true);
    });

    it('offers one doctor and one published week', () => {
      expect(session.doctors().length).toBe(1);
      expect(session.doctors()[0].doctor.id).toBe(DESK);
      expect(Object.keys(session.schedule())).toEqual([DESK]);
    });

    it('orders appointments soonest first', () => {
      const times = session.appointments().map((a) => a.startsAt);
      expect([...times].sort()).toEqual(times);
    });

    it('counts only the visits this desk could have watched', () => {
      // `visitCount` is built from the scoped appointments, so a patient who also
      // saw another doctor reads as having fewer visits here. That is the honest
      // answer, and it is the reason the figure is derived rather than stored.
      const onDesk = MOCK_APPOINTMENTS.filter((a) => a.doctorId === DESK);
      const done = onDesk.filter((a) => a.status === 'completed' || a.status === 'no-show');
      expect(session.patients().reduce((total, p) => total + p.visitCount, 0)).toBe(done.length);
    });
  });

  describe('a desk with no doctor, and a desk with a disabled one', () => {
    // Both are reachable in the real flow: a Secretary can be created before a
    // doctor is enabled, and an administrator can disable the doctor afterwards.
    it('reads as empty everywhere rather than as the whole clinic', () => {
      assignTo(session, null);

      expect(session.assignedDoctor()).toBeNull();
      expect(session.appointments()).toEqual([]);
      expect(session.patients()).toEqual([]);
      expect(session.doctors()).toEqual([]);
      expect(session.schedule()).toEqual({});
      expect(session.conversations()).toEqual([]);
      expect(session.unreadMessageCount()).toBe(0);
      expect(session.awaitingActionCount()).toBe(0);
      expect(session.unassignedMessage).toContain('not assigned to a doctor');
    });

    it('refuses every booking, because there is nobody to book for', () => {
      assignTo(session, null);

      expect(
        session.bookingRefusal({
          patientId: DESK_PATIENT,
          doctorId: '',
          startsAt: localIso(nextOpenDay(DESK, 7)),
          durationMinutes: 30,
          reason: 'Test booking',
        }),
      ).toBe('no-patient');
    });

    it('shows a disabled doctor as not taking bookings', () => {
      const inactive = MOCK_DOCTORS.find((d) => d.status === 'inactive')!;
      assignTo(session, inactive.id);

      expect(session.doctors()[0].doctor.id).toBe(inactive.id);
      expect(session.doctors()[0].weeklyHours).toBe('Not taking bookings');
      expect(session.activeDoctorCount()).toBe(0);
    });

    it('refuses to book for a doctor who has been disabled', () => {
      const inactive = MOCK_DOCTORS.find((d) => d.status === 'inactive')!;
      assignTo(session, inactive.id);

      // A plain future time rather than a published slot: this doctor has no
      // published day at all, and the store checks their status before it looks
      // at any hour, so asking for one would fail for the wrong reason.
      expect(
        session.bookingRefusal({
          patientId: MOCK_PATIENTS.find((p) => p.doctorId === inactive.id)!.id,
          doctorId: inactive.id,
          startsAt: futureAt(7, 10),
          durationMinutes: 30,
          reason: 'Test booking',
        }),
      ).toBe('inactive-doctor');
    });
  });

  describe('another doctor reached by id', () => {
    const other = MOCK_DOCTORS.find((d) => d.id !== DESK)!;
    const otherPatient = MOCK_PATIENTS.find((p) => p.doctorId === other.id)!;

    it('will not look up their patient', () => {
      // The list filter is not the only door: a route param is a perfectly good
      // way to ask for somebody else's record.
      expect(session.patientById(otherPatient.id)).toBeNull();
    });

    it('returns no appointments for them, by patient or by doctor', () => {
      expect(session.appointmentsForPatient(otherPatient.id)).toEqual([]);
      expect(session.appointmentsForDoctor(other.id)).toEqual([]);
    });

    it('returns an empty week for them', () => {
      expect(session.scheduleFor(other.id)).toEqual([]);
      expect(session.weeklyMinutes(other.id)).toBe(0);
    });

    it('refuses to reschedule or cancel one of their appointments', () => {
      // The scoped list never offers these ids, but the store refusing them is what
      // makes the scoping something the store owns rather than a view's accident.
      const theirs = MOCK_APPOINTMENTS.find(
        (a) => a.doctorId === other.id && a.status === 'booked',
      )!;

      expect(session.reschedule(theirs.id, localIso(nextOpenDay(other.id, 21)))).toBe(false);
      expect(session.cancel(theirs.id)).toBe(false);
      expect(
        MOCK_APPOINTMENTS.find((a) => a.id === theirs.id)!.status,
        'the fixture is untouched, so a refusal is not a write',
      ).toBe('booked');
    });

    it('cannot be booked for', () => {
      expect(
        session.bookingRefusal({
          patientId: DESK_PATIENT,
          doctorId: other.id,
          startsAt: localIso(nextOpenDay(other.id, 7)),
          durationMinutes: 30,
          reason: 'Test booking',
        }),
      ).toBe('not-your-doctor');
    });
  });

  describe('today', () => {
    it("lists today's appointments, all of them the assigned doctor's", () => {
      const today = session.todaysAppointments();
      expect(today.length).toBeGreaterThan(0);
      for (const appointment of today) {
        expect(appointment.startsAt.slice(0, 10)).toBe(dayKey(session.now()));
        expect(appointment.doctorId).toBe(DESK);
      }
    });

    it('drops a cancelled appointment from the day plan', () => {
      // Behaviour, not fixture luck: whether any *given* day happens to contain a
      // cancellation depends on the weekday the suite runs on, so this books and
      // cancels rather than asserting the sample data is arranged favourably.
      const { doctorId, at } = freeSlotToday(session);
      session.now.set(new Date(at.getTime() - 60_000));

      const created = session.book({
        patientId: DESK_PATIENT,
        doctorId,
        startsAt: localIso(at),
        durationMinutes: 30,
        reason: 'Cancelled later the same day',
      })!;
      expect(session.todaysAppointments().map((a) => a.id)).toContain(created.id);

      session.cancel(created.id);
      expect(session.todaysAppointments().map((a) => a.id)).not.toContain(created.id);
      // Still in the list — cancelling is not deleting.
      expect(session.appointments().map((a) => a.id)).toContain(created.id);
    });

    it('leaves a closed appointment out of the next-appointment figure', () => {
      const { doctorId, at } = freeSlotToday(session);
      session.now.set(new Date(at.getTime() - 60_000));
      const created = session.book({
        patientId: DESK_PATIENT,
        doctorId,
        startsAt: localIso(at),
        durationMinutes: 30,
        reason: 'Cancelled later the same day',
      })!;
      expect(session.nextAppointment()?.id).toBe(created.id);

      session.cancel(created.id);
      expect(session.nextAppointment()?.id).not.toBe(created.id);
    });
  });

  describe('booking rules', () => {
    const draft = (over: Partial<Parameters<SecretarySession['bookingRefusal']>[0]> = {}) => ({
      patientId: DESK_PATIENT,
      doctorId: DESK,
      startsAt: localIso(nextOpenDay(DESK, 7)),
      durationMinutes: 30,
      reason: 'Test booking',
      ...over,
    });

    /** Moves the clock to just before a proposed slot so only one rule is in play. */
    function before(date: Date): void {
      session.now.set(new Date(date.getTime() - 60_000));
    }

    it('refuses a booking in the past', () => {
      const past = new Date();
      past.setDate(past.getDate() - 3);
      expect(session.bookingRefusal(draft({ startsAt: localIso(past) }))).toBe('not-in-the-future');
    });

    it('refuses a booking with no patient chosen', () => {
      expect(session.bookingRefusal(draft({ patientId: '' }))).toBe('no-patient');
    });

    it('refuses a booking for a patient on another doctor desk', () => {
      // Same refusal as an id nobody has. Telling the two apart would confirm that
      // the patient exists somewhere in the clinic, which is what the scoping is for.
      const elsewhere = MOCK_PATIENTS.find((p) => p.doctorId !== DESK)!;
      expect(session.bookingRefusal(draft({ patientId: elsewhere.id }))).toBe('no-patient');
    });

    it('refuses a booking with no doctor chosen', () => {
      expect(session.bookingRefusal(draft({ doctorId: '' }))).toBe('no-doctor');
    });

    it('refuses a booking for a patient or doctor that does not exist', () => {
      expect(session.bookingRefusal(draft({ patientId: 'pat-999' }))).toBe('no-patient');
      expect(session.bookingRefusal(draft({ doctorId: 'doc-999' }))).toBe('no-doctor');
    });

    it('refuses a booking for a day the doctor does not work', () => {
      // The assigned doctor's one closed weekday.
      const closed = new Date();
      while (MOCK_SCHEDULES[DESK][closed.getDay()].enabled) {
        closed.setDate(closed.getDate() + 1);
      }
      closed.setHours(10, 0, 0, 0);
      before(closed);

      expect(session.bookingRefusal(draft({ startsAt: localIso(closed) }))).toBe('day-closed');
    });

    it('refuses a booking before the doctor opens', () => {
      const early = nextOpenDay(DESK, 7, -120);
      before(early);
      expect(session.bookingRefusal(draft({ startsAt: localIso(early) }))).toBe('outside-hours');
    });

    it('refuses a booking that would clash with the doctor', () => {
      // Book over the top of a future live appointment of the same doctor.
      const clash = session
        .appointments()
        .filter((a) => a.status === 'booked' || a.status === 'confirmed')
        .filter((a) => new Date(a.startsAt).getTime() > session.now().getTime())
        .find((a) => a.doctorId === DESK)!;

      before(new Date(clash.startsAt));
      expect(session.bookingRefusal(draft({ doctorId: DESK, startsAt: clash.startsAt }))).toBe(
        'doctor-busy',
      );
    });

    it('allows a booking that starts exactly when another one ends', () => {
      // Half-open intervals: back-to-back appointments are the normal case, so
      // treating the boundary as a clash would make a full day unbookable.
      const first = session
        .appointments()
        .filter((a) => a.status === 'booked' || a.status === 'confirmed')
        .filter((a) => new Date(a.startsAt).getTime() > session.now().getTime())
        .find((a) => a.doctorId === DESK && a.durationMinutes === 30)!;

      const ends = new Date(first.startsAt);
      ends.setMinutes(ends.getMinutes() + first.durationMinutes);
      before(new Date(first.startsAt));

      expect(
        session.bookingRefusal(
          draft({ doctorId: DESK, startsAt: localIso(ends), durationMinutes: 30 }),
        ),
      ).not.toBe('doctor-busy');
    });

    it('refuses the same booking twice at the same time', () => {
      const first = draft();
      before(new Date(first.startsAt));
      expect(session.book(first)).not.toBeNull();
      // The second attempt overlaps the one that was just created.
      expect(session.bookingRefusal(first)).toBe('doctor-busy');
      expect(session.book(first)).toBeNull();
    });

    it('creates a booking as "booked", never as confirmed', () => {
      // Confirming is the patient's or doctor's step; a Secretary's new booking
      // must not skip it.
      const first = draft();
      before(new Date(first.startsAt));
      expect(session.book(first)?.status).toBe('booked');
    });

    it('gives a new booking an id nothing else has taken', () => {
      const first = draft();
      before(new Date(first.startsAt));
      const created = session.book(first)!;
      expect(session.appointments().some((a) => a.id === created.id)).toBe(true);
      expect(new Set(session.appointments().map((a) => a.id)).size).toBe(
        session.appointments().length,
      );
    });

    it('refuses a booking that runs past the doctor closing time', () => {
      // The last half hour of the published window, booked for longer than it
      // lasts: still starting inside the hours, but no longer finishing inside
      // them.
      const late = nextOpenDay(DESK, 7, 150);
      before(late);
      expect(session.bookingRefusal(draft({ startsAt: localIso(late), durationMinutes: 45 }))).toBe(
        'ends-after-close',
      );
    });

    it('refuses a booking that ends exactly on closing time', () => {
      // The boundary is inclusive: a slot finishing at the moment the doctor
      // closes is a legitimate booking, and refusing it would waste the last
      // half hour of every clinic day.
      const closing = nextOpenDay(DESK, 7, 120);
      before(closing);
      expect(
        session.bookingRefusal(draft({ startsAt: localIso(closing), durationMinutes: 60 })),
      ).toBeNull();
    });
  });

  describe('rescheduling', () => {
    let live: Appointment;

    /** A future live appointment of the assigned doctor, with the clock moved before it. */
    function futureLive(): Appointment {
      return session
        .appointments()
        .filter((a) => a.status === 'booked' || a.status === 'confirmed')
        .filter((a) => new Date(a.startsAt).getTime() > session.now().getTime())
        .find((a) => a.doctorId === DESK)!;
    }

    beforeEach(() => {
      live = futureLive();
    });

    it('moves a booking into a free published slot and keeps its status', () => {
      const target = nextOpenDay(DESK, 21);
      session.now.set(new Date(target.getTime() - 60_000));

      expect(session.reschedule(live.id, localIso(target))).toBe(true);
      const moved = session.appointments().find((a) => a.id === live.id)!;
      expect(moved.startsAt).toBe(localIso(target));
      // Rescheduling is not a status change: whatever it was before, it still is.
      expect(moved.status).toBe(live.status);
    });

    it('keeps the patient, doctor and duration of a moved appointment', () => {
      const target = nextOpenDay(DESK, 21);
      session.now.set(new Date(target.getTime() - 60_000));
      session.reschedule(live.id, localIso(target));

      const moved = session.appointments().find((a) => a.id === live.id)!;
      expect(moved.patientId).toBe(live.patientId);
      expect(moved.doctorId).toBe(live.doctorId);
      expect(moved.durationMinutes).toBe(live.durationMinutes);
      expect(moved.reason).toBe(live.reason);
    });

    it('lets an appointment move onto its own current slot', () => {
      // Without the self-exclusion this would report a clash with itself and the
      // move would be impossible to save.
      session.now.set(new Date(new Date(live.startsAt).getTime() - 60_000));
      expect(session.reschedule(live.id, live.startsAt)).toBe(true);
    });

    it('refuses a move that would clash with another appointment', () => {
      const other = futureLive();
      const clash = session
        .appointments()
        .find(
          (a) =>
            a.id !== live.id &&
            a.doctorId === other.doctorId &&
            (a.status === 'booked' || a.status === 'confirmed') &&
            new Date(a.startsAt).getTime() > session.now().getTime(),
        )!;

      session.now.set(new Date(new Date(clash.startsAt).getTime() - 60_000));
      expect(session.reschedule(live.id, clash.startsAt)).toBe(false);
    });

    it('refuses a move outside the doctor published hours', () => {
      const closed = new Date();
      while (MOCK_SCHEDULES[DESK][closed.getDay()].enabled) {
        closed.setDate(closed.getDate() + 1);
      }
      closed.setHours(10, 0, 0, 0);
      session.now.set(new Date(closed.getTime() - 60_000));

      expect(session.reschedule(live.id, localIso(closed))).toBe(false);
    });

    it('refuses to move an appointment that has already finished', () => {
      const finished = session.appointments().find((a) => a.status === 'completed')!;
      const target = nextOpenDay(DESK, 21);
      session.now.set(new Date(target.getTime() - 60_000));
      expect(session.reschedule(finished.id, localIso(target))).toBe(false);
    });

    it('refuses to revive a cancelled appointment', () => {
      // Its time no longer matters, and reviving one silently would make a
      // cancellation reversible without anyone deciding to.
      const cancelled = session.appointments().find((a) => a.status === 'cancelled')!;
      expect(session.reschedule(cancelled.id, localIso(nextOpenDay(DESK, 21)))).toBe(false);
    });

    it('refuses an id that matches no appointment', () => {
      expect(session.reschedule('appt-999', localIso(nextOpenDay(DESK, 21)))).toBe(false);
    });
  });

  describe('cancelling', () => {
    it('cancels a live appointment', () => {
      const live = session.appointments().find((a) => a.status === 'booked')!;
      expect(session.cancel(live.id)).toBe(true);
      expect(session.appointments().find((a) => a.id === live.id)?.status).toBe('cancelled');
    });

    it('ignores a second cancel, so history cannot be rewritten', () => {
      const live = session.appointments().find((a) => a.status === 'booked')!;
      expect(session.cancel(live.id)).toBe(true);
      expect(session.cancel(live.id)).toBe(false);
    });

    it('refuses to cancel an appointment that already happened', () => {
      const done = session.appointments().find((a) => a.status === 'completed')!;
      expect(session.cancel(done.id)).toBe(false);
    });
  });

  describe('the doctor and their schedule', () => {
    it('lists the assigned doctor and nobody else', () => {
      expect(session.doctors().map((s) => s.doctor.id)).toEqual([DESK]);
    });

    it('counts the assigned doctor as taking bookings', () => {
      const desk = MOCK_DOCTORS.find((d) => d.id === DESK)!;
      expect(session.activeDoctorCount()).toBe(desk.status === 'active' ? 1 : 0);
    });

    it('summarises the assigned doctor weekly hours from what they publish', () => {
      // doc-003 works six mornings of three hours, Monday closed.
      expect(session.doctors()[0].weeklyHours).toBe('18h a week');
    });

    it('gives the assigned doctor a seven-day week, Sunday-first', () => {
      expect(session.scheduleFor(DESK).map((d) => d.dayOfWeek)).toEqual([0, 1, 2, 3, 4, 5, 6]);
      expect(session.scheduleFor(DESK)).toHaveLength(7);
    });

    it('returns an empty week for an id that matches nobody', () => {
      // A doctor with no schedule must read as "no hours", not throw — the
      // schedules page renders whatever it is given.
      expect(session.scheduleFor('doc-999')).toEqual([]);
    });

    it('counts published minutes per week', () => {
      const expected = MOCK_SCHEDULES[DESK].reduce((total, day) => {
        if (!day.enabled) return total;
        return total + (minutesOfDay(day.endTime)! - minutesOfDay(day.startTime)!);
      }, 0);
      expect(session.weeklyMinutes(DESK)).toBe(expected);
    });

    it('places every fixture appointment inside its doctor published hours', () => {
      // The whole area rests on this: if a fixture sat outside published hours,
      // the booking rules would be refusing to describe the clinic's own data.
      // Checked against the schedule directly rather than through
      // `bookingRefusal`, which would also report each appointment clashing with
      // itself.
      for (const appointment of MOCK_APPOINTMENTS) {
        const startsAt = new Date(appointment.startsAt);
        const day = MOCK_SCHEDULES[appointment.doctorId][startsAt.getDay()];
        const start = startsAt.getHours() * 60 + startsAt.getMinutes();
        const label = `${appointment.id} ${appointment.startsAt}`;

        expect(day.enabled, label).toBe(true);
        expect(start, label).toBeGreaterThanOrEqual(minutesOfDay(day.startTime)!);
        expect(start + appointment.durationMinutes, label).toBeLessThanOrEqual(
          minutesOfDay(day.endTime)!,
        );
      }
    });

    it('never gives one doctor two live appointments in the same slot', () => {
      // Otherwise the sample clinic would contain a double booking the booking
      // form is unable to reproduce, and every "this time is free" answer would
      // be contradicted by the list underneath it.
      for (const doctor of MOCK_DOCTORS) {
        const live = MOCK_APPOINTMENTS.filter(
          (a) => a.doctorId === doctor.id && (a.status === 'booked' || a.status === 'confirmed'),
        ).sort((a, b) => a.startsAt.localeCompare(b.startsAt));

        for (let i = 0; i < live.length - 1; i++) {
          const current = live[i];
          const next = live[i + 1];
          if (current.startsAt.slice(0, 10) !== next.startsAt.slice(0, 10)) continue;

          const endsAt = new Date(current.startsAt).getTime() + current.durationMinutes * 60_000;
          expect(
            new Date(next.startsAt).getTime(),
            `${current.id} overlaps ${next.id}`,
          ).toBeGreaterThanOrEqual(endsAt);
        }
      }
    });

    it('never gives an appointment to a doctor who is not taking bookings', () => {
      const inactive = new Set(MOCK_DOCTORS.filter((d) => d.status !== 'active').map((d) => d.id));
      for (const appointment of MOCK_APPOINTMENTS) {
        expect(inactive.has(appointment.doctorId), appointment.id).toBe(false);
      }
    });

    it('refuses nothing about this desk own live appointments', () => {
      // The end-to-end version of the hours check: with the clock a week back,
      // every fixture booking on this desk is one the store itself would accept.
      // This is what catches a schedule edited without the appointments being
      // moved with it — and it only covers this desk, because an appointment
      // belonging to another doctor is refused before any hour is considered.
      session.now.set(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      const live = MOCK_APPOINTMENTS.filter(
        (a) => a.doctorId === DESK && (a.status === 'booked' || a.status === 'confirmed'),
      );
      expect(live.length).toBeGreaterThan(0);

      for (const appointment of live) {
        expect(
          session.bookingRefusal(
            {
              patientId: appointment.patientId,
              doctorId: appointment.doctorId,
              startsAt: appointment.startsAt,
              durationMinutes: appointment.durationMinutes,
              reason: appointment.reason,
            },
            // Ignore the appointment's own slot: it would otherwise clash with
            // itself and tell us nothing about whether it is bookable.
            appointment.id,
          ),
          appointment.id,
        ).toBeNull();
      }
    });

    it('refuses every other doctor fixture appointment as off this desk', () => {
      // The same data from the other side: on somebody else's appointment the
      // store's answer is the scoping rule, not an hours complaint. Which of the two
      // refusals comes back depends on whether the patient happens to be on this
      // panel — a patient who also saw this doctor gets `not-your-doctor`, one who
      // does not gets `no-patient` first — and both are the scoping rule.
      session.now.set(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      const theirs = MOCK_APPOINTMENTS.filter((a) => a.doctorId !== DESK);
      expect(theirs.length).toBeGreaterThan(0);

      for (const appointment of theirs) {
        const refusal = session.bookingRefusal(
          {
            patientId: appointment.patientId,
            doctorId: appointment.doctorId,
            startsAt: appointment.startsAt,
            durationMinutes: appointment.durationMinutes,
            reason: appointment.reason,
          },
          appointment.id,
        );
        expect(['no-patient', 'not-your-doctor'], appointment.id).toContain(refusal);
      }
    });
  });

  describe('messaging', () => {
    // The outer `beforeEach` rewinds the clock to today's first appointment, which
    // is *earlier* than the newest message fixture — the message fixtures are
    // anchored to when the module was imported, not to a booking. A reply sent on
    // that clock would be stamped before the messages it is replying to and would
    // sort into the middle of the thread, so messaging starts from the real clock.
    beforeEach(() => session.now.set(new Date()));

    it('lists only this desk threads, most recently active first', () => {
      // Resolved through the party rather than compared to the id directly: a
      // patient thread points at a patient, and reading it as a doctor id would
      // leave this desk with no patient messages at all.
      const expected = MOCK_CONVERSATIONS.filter((conversation) =>
        conversation.party === 'doctor'
          ? conversation.partyId === DESK
          : MOCK_PATIENTS.find((p) => p.id === conversation.partyId)?.doctorId === DESK,
      );
      expect(expected.length).toBeGreaterThan(0);
      expect(expected.length).toBeLessThan(MOCK_CONVERSATIONS.length);
      expect(session.conversations().length).toBe(expected.length);

      const times = session.conversations().map((c) => c.lastSentAt);
      expect([...times].sort().reverse()).toEqual(times);
    });

    it('does not count threads belonging to another desk in either badge', () => {
      // The nav badges read these, so a clinic-wide count here would put another
      // Secretary's patients in the number over this desk's head.
      const theirs = MOCK_CONVERSATIONS.filter(
        (c) => !session.conversations().some((s) => s.conversation.id === c.id),
      );
      expect(theirs.length).toBeGreaterThan(0);
      expect(session.awaitingActionCount()).toBe(
        session.conversations().filter((c) => c.conversation.awaitingAction).length,
      );
    });

    it('names each conversation after the patient or doctor fixture it points at', () => {
      // `partyId` rather than a copied name, so a thread cannot disagree with the
      // Patients page about who somebody is.
      for (const { conversation, name } of session.conversations()) {
        const expected =
          conversation.party === 'doctor'
            ? session.doctorById(conversation.partyId)?.name
            : session.patientById(conversation.partyId)?.name;
        expect(name).toBe(expected);
      }
    });

    it('carries messages in the order they were sent', () => {
      for (const { messages } of session.conversations()) {
        const times = messages.map((m) => m.sentAt);
        expect([...times].sort()).toEqual(times);
      }
    });

    it('counts unread only for the other party', () => {
      // Your own reply is never unread. Counting it would make the number go up
      // the moment you answered somebody, which is the opposite of useful.
      for (const { messages, unreadCount } of session.conversations()) {
        const expected = messages.filter((m) => !m.fromSecretary && m.readAt === null).length;
        expect(unreadCount).toBe(expected);
      }
    });

    it('agrees with the sum of the per-thread counts', () => {
      // The nav badge and the list below it are counting the same set. Two
      // independent counts is how a badge ends up promising something that is not
      // flagged in the list.
      const summed = session.conversations().reduce((total, c) => total + c.unreadCount, 0);
      expect(session.unreadMessageCount()).toBe(summed);
    });

    it('has a thread that is read to the end and still owes the clinic something', () => {
      // The case that collapses if `awaitingAction` is derived from the unread
      // count: a thread the Secretary has read and not yet acted on.
      const settled = session
        .conversations()
        .filter((c) => c.unreadCount === 0 && c.conversation.awaitingAction);
      expect(settled.length).toBeGreaterThan(0);
    });

    it('marks a thread read without touching the messages you sent', () => {
      const target = session.conversations().find((c) => c.unreadCount > 0)!;
      const mineBefore = target.messages.filter((m) => m.fromSecretary).length;

      expect(session.markConversationRead(target.conversation.id)).toBe(true);

      const after = session.conversationById(target.conversation.id)!;
      expect(after.unreadCount).toBe(0);
      expect(after.messages.filter((m) => m.fromSecretary).length).toBe(mineBefore);
      expect(after.messages.every((m) => m.fromSecretary || m.readAt !== null)).toBe(true);
    });

    it('reports no change when marking an already-read thread', () => {
      // The caller uses this to tell a real transition from a no-op, so it has to
      // be honest rather than always returning true.
      const target = session.conversations().find((c) => c.unreadCount > 0)!;
      session.markConversationRead(target.conversation.id);
      expect(session.markConversationRead(target.conversation.id)).toBe(false);
    });

    it('appends a reply and puts it at the end of the thread', () => {
      const target = session.conversations()[0];
      const before = target.messages.length;

      const sent = session.sendMessage(target.conversation.id, '  Confirmed for 5:30 PM.  ');

      expect(sent).not.toBeNull();
      expect(sent!.fromSecretary).toBe(true);
      expect(sent!.body).toBe('Confirmed for 5:30 PM.');
      expect(sent!.readAt).not.toBeNull();

      const after = session.conversationById(target.conversation.id)!;
      expect(after.messages.length).toBe(before + 1);
      expect(after.messages[after.messages.length - 1].id).toBe(sent!.id);
    });

    it('refuses an empty or whitespace-only reply', () => {
      // So the composer can clear itself only when something was actually sent,
      // rather than eating what somebody typed.
      const target = session.conversations()[0];
      expect(session.sendMessage(target.conversation.id, '   ')).toBeNull();
      expect(session.sendMessage(target.conversation.id, '')).toBeNull();
      expect(session.conversationById(target.conversation.id)!.messages.length).toBe(
        target.messages.length,
      );
    });

    it('refuses a reply to a thread that does not exist', () => {
      expect(session.sendMessage('cnv-nope', 'Hello?')).toBeNull();
    });

    it('refuses to read or reply to a thread on another desk', () => {
      // Same refusal as an unknown id: a thread on another desk is not something
      // this session can act on at all, and saying so differently would confirm it
      // exists.
      const theirs = MOCK_CONVERSATIONS.find(
        (c) => !session.conversations().some((s) => s.conversation.id === c.id),
      )!;

      expect(session.conversationById(theirs.id)).toBeNull();
      expect(session.sendMessage(theirs.id, 'Hello?')).toBeNull();
      expect(session.markConversationRead(theirs.id)).toBe(false);
    });

    it('gives two replies in a session different ids', () => {
      // Checked against the live list rather than the fixtures, for the same
      // reason appointment ids are: a collision would overwrite the first reply.
      const target = session.conversations()[0];
      const first = session.sendMessage(target.conversation.id, 'First')!;
      const second = session.sendMessage(target.conversation.id, 'Second')!;
      expect(first.id).not.toBe(second.id);
    });

    it('flattens a multi-line reply to one line for the list preview', () => {
      // The row is one line tall, so a body with newlines has to be collapsed
      // rather than left to CSS to clip at some height.
      const target = session.conversations()[0];
      session.sendMessage(target.conversation.id, 'Line one\nLine two\n\nLine four');

      const after = session.conversationById(target.conversation.id)!;
      expect(after.preview).toBe('Line one Line two Line four');
      expect(after.preview).not.toContain('\n');
    });

    it('says a patient is booked rather than calling them new', () => {
      // `visitCount` counts only completed and missed appointments, so a patient
      // with a confirmed appointment for next week would otherwise read as
      // "New patient" — which is both wrong and easy to say out loud to them.
      const booked = MOCK_APPOINTMENTS.find(
        (a) =>
          a.status === 'confirmed' &&
          session.conversations().some((c) => c.conversation.partyId === a.patientId),
      );
      if (!booked) return;

      const conversation = MOCK_CONVERSATIONS.find((c) => c.partyId === booked.patientId)!;
      expect(session.conversationSubtitle(conversation)).toContain('Next visit');
      expect(session.conversationSubtitle(conversation)).not.toContain('New patient');
    });

    it('describes a doctor by specialty, not by visit count', () => {
      // Reached by putting the session on that doctor's desk: the sample's own
      // doctor thread belongs to somebody else, which is the point of the filter.
      const thread = MOCK_CONVERSATIONS.find((c) => c.party === 'doctor')!;
      assignTo(session, thread.partyId);

      const doctor = session.conversations().find((c) => c.conversation.party === 'doctor')!;
      const expected = session.doctorById(doctor.conversation.partyId)!.specialization;
      expect(session.conversationSubtitle(doctor.conversation)).toBe(`Doctor · ${expected}`);
    });

    it('tolerates a conversation whose id matches nothing', () => {
      expect(session.conversationById('cnv-nope')).toBeNull();
    });
  });

  describe('profile', () => {
    it('updates the fields the profile page owns, and nothing else', () => {
      const before = session.profile();
      session.updateProfile({ name: 'New Name', email: 'new@mediq.ph', phone: '+63 900 000 0000' });
      const after = session.profile();
      expect(after.name).toBe('New Name');
      expect(after.email).toBe('new@mediq.ph');
      expect(after.joinedOn).toBe(before.joinedOn);
    });

    it('cannot be used to reassign the Secretary to another doctor', () => {
      // The assignment is an administrator's to make. It is not in the
      // `ProfileDraft` type, and this checks the store agrees at runtime rather
      // than only at compile time.
      const before = session.profile().assignedDoctorId;
      session.updateProfile({
        name: 'New Name',
        email: 'new@mediq.ph',
        phone: '+63 900 000 0000',
        assignedDoctorId: MOCK_DOCTORS.find((d) => d.id !== DESK)!.id,
      } as any);

      expect(session.profile().assignedDoctorId).toBe(before);
    });
  });
});
