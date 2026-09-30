import { TestBed } from '@angular/core/testing';
import { dayKey } from './doctor.dates';
import { MOCK_APPOINTMENTS, MOCK_PATIENTS, SIGNED_IN_DOCTOR_ID } from './doctor.mock-data';
import { DoctorSession } from './doctor-session';

/**
 * Pins the session clock to the first fixture appointment, which is a
 * "today" appointment, so the day-scoped computeds are deterministic.
 */
function pinToFirstAppointment(session: DoctorSession): void {
  session.now.set(new Date(MOCK_APPOINTMENTS[0].startsAt));
}

describe('DoctorSession', () => {
  let session: DoctorSession;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [DoctorSession] });
    session = TestBed.inject(DoctorSession);
    pinToFirstAppointment(session);
  });

  describe('scoping to the signed-in doctor', () => {
    it('hides appointments belonging to another doctor', () => {
      const foreign = MOCK_APPOINTMENTS.filter((a) => a.doctorId !== SIGNED_IN_DOCTOR_ID);
      expect(foreign.length).toBeGreaterThan(0);
      for (const appointment of session.appointments()) {
        expect(appointment.doctorId).toBe(SIGNED_IN_DOCTOR_ID);
      }
    });

    it('leaves a patient out when they have only ever seen another doctor', () => {
      // pat-113's single appointment belongs to doc-001, so the doctor must not
      // be able to reach them — not in the list, and not by id.
      expect(MOCK_APPOINTMENTS.some((a) => a.patientId === 'pat-113')).toBe(true);
      expect(session.patients().some((s) => s.patient.id === 'pat-113')).toBe(false);
    });

    it('keeps a patient who has only a past appointment', () => {
      const past = MOCK_APPOINTMENTS.find((a) => a.status === 'completed');
      expect(session.patients().some((s) => s.patient.id === past?.patientId)).toBe(true);
    });

    it('is a shorter list than every patient on file', () => {
      expect(session.patients().length).toBeLessThan(MOCK_PATIENTS.length);
    });
  });

  describe('today', () => {
    it("lists today's appointments, soonest first", () => {
      const today = session.todaysAppointments();
      expect(today.length).toBeGreaterThan(0);
      for (const appointment of today) {
        expect(appointment.startsAt.slice(0, 10)).toBe(dayKey(session.now()));
      }
      const times = today.map((a) => a.startsAt);
      expect([...times].sort()).toEqual(times);
    });

    it('drops cancelled appointments from the day plan', () => {
      const cancelledToday = MOCK_APPOINTMENTS.filter(
        (a) => a.doctorId === SIGNED_IN_DOCTOR_ID && a.status === 'cancelled',
      );
      expect(cancelledToday.length).toBeGreaterThan(0);
      const ids = session.todaysAppointments().map((a) => a.id);
      for (const appointment of cancelledToday) {
        expect(ids).not.toContain(appointment.id);
      }
    });

    it('moves the day on when the clock does', () => {
      const before = session.todaysAppointments().length;
      session.now.set(new Date('2030-01-01T10:00:00'));
      expect(session.todaysAppointments().length).toBe(0);
      session.now.set(new Date(MOCK_APPOINTMENTS[0].startsAt));
      expect(session.todaysAppointments().length).toBe(before);
    });
  });

  describe('nextAppointment', () => {
    it('is the first appointment that has not started', () => {
      const next = session.nextAppointment();
      expect(next).not.toBeNull();
      expect(new Date(next!.startsAt).getTime()).toBeGreaterThanOrEqual(session.now().getTime());
      expect(['booked', 'confirmed']).toContain(next!.status);
    });

    it('never points at a cancelled appointment', () => {
      for (const appointment of session.appointments()) {
        session.setAppointmentStatus(appointment.id, 'cancelled');
      }
      expect(session.nextAppointment()).toBeNull();
    });
  });

  describe('awaitingConfirmation', () => {
    it('counts only booked appointments', () => {
      const expected = session.appointments().filter((a) => a.status === 'booked').length;
      expect(session.awaitingConfirmation().length).toBe(expected);
    });
  });

  describe('setAppointmentStatus', () => {
    it('moves an appointment forward', () => {
      const booked = session.appointments().find((a) => a.status === 'booked')!;
      expect(session.setAppointmentStatus(booked.id, 'confirmed')).toBe(true);
      expect(session.appointments().find((a) => a.id === booked.id)?.status).toBe('confirmed');
    });

    it('reports no change for an unknown id', () => {
      expect(session.setAppointmentStatus('appt-999', 'confirmed')).toBe(false);
    });

    it('reports no change when the status already holds, so a double click is harmless', () => {
      const confirmed = session.appointments().find((a) => a.status === 'confirmed')!;
      expect(session.setAppointmentStatus(confirmed.id, 'confirmed')).toBe(false);
      expect(session.appointments().filter((a) => a.id === confirmed.id).length).toBe(1);
    });

    it("leaves another doctor's appointment alone", () => {
      const foreign = MOCK_APPOINTMENTS.find((a) => a.doctorId !== SIGNED_IN_DOCTOR_ID)!;
      expect(session.setAppointmentStatus(foreign.id, 'completed')).toBe(false);
      expect(MOCK_APPOINTMENTS.find((a) => a.id === foreign.id)!.status).not.toBe('completed');
    });
  });

  describe('patient summaries', () => {
    it('reports the last past visit and the next booked one', () => {
      const summary = session.patients().find((s) => s.patient.id === 'pat-101')!;
      expect(summary.lastVisit?.id).toBe('appt-111');
      expect(summary.nextVisit?.id).toBe('appt-101');
    });

    it('reports no last visit for a patient who has not been seen yet', () => {
      const summary = session.patients().find((s) => s.nextVisit?.id === 'appt-113')!;
      expect(summary.lastVisit).toBeNull();
    });

    it('counts a no-show as a visit but not a cancelled one', () => {
      const noShow = session.patients().find((s) => s.patient.id === 'pat-110')!;
      expect(noShow.visitCount).toBe(1);

      const cancelled = session.patients().find((s) => s.patient.id === 'pat-108')!;
      expect(cancelled.visitCount).toBe(0);
    });

    it('drops a cancelled booking from the next visit', () => {
      const before = session.patients().find((s) => s.patient.id === 'pat-108')!;
      expect(before.nextVisit?.id).toBe('appt-115');

      session.setAppointmentStatus('appt-115', 'cancelled');
      expect(session.patients().find((s) => s.patient.id === 'pat-108')!.nextVisit).toBeNull();
    });
  });

  describe('lookups', () => {
    it('resolves a patient by id', () => {
      expect(session.patientById('pat-101')?.name).toBe('Juan Dela Cruz');
    });

    it('returns null rather than throwing for an unknown id', () => {
      expect(session.patientById('pat-999')).toBeNull();
    });

    it('refuses a real patient the doctor has never been given', () => {
      // The details page is addressed by id, and an id is user input.
      expect(session.patientById('pat-113')).not.toBeNull();
      expect(session.patientForDoctor('pat-113')).toBeNull();
      expect(session.patientForDoctor('pat-101')?.name).toBe('Juan Dela Cruz');
    });

    it('refuses an empty id without touching the store', () => {
      expect(session.patientForDoctor('')).toBeNull();
    });

    it('names an unknown patient instead of rendering undefined', () => {
      expect(session.patientName('pat-999')).toBe('Unknown patient');
    });

    it("returns only this doctor's appointments for a patient", () => {
      const all = session.appointmentsForPatient('pat-101');
      expect(all.length).toBeGreaterThan(0);
      for (const appointment of all) expect(appointment.doctorId).toBe(SIGNED_IN_DOCTOR_ID);
    });
  });

  describe('schedule', () => {
    it('starts from the published week', () => {
      expect(session.schedule().length).toBe(7);
      expect(session.schedule()[0].dayOfWeek).toBe(0);
    });

    it('totals only the days that are open', () => {
      const open = session.schedule().filter((d) => d.enabled);
      const expected = open.reduce((total, day) => {
        const [sh, sm] = day.startTime.split(':').map(Number);
        const [eh, em] = day.endTime.split(':').map(Number);
        return total + (eh * 60 + em - (sh * 60 + sm));
      }, 0);
      expect(session.weeklyMinutes()).toBe(expected);
    });

    it('ignores a day whose end is not after its start', () => {
      const broken = session
        .schedule()
        .map((day, i) =>
          i === 0 ? { ...day, enabled: true, startTime: '17:00', endTime: '09:00' } : day,
        );
      session.saveSchedule(broken);
      const withBadDay = session.weeklyMinutes();
      const good = broken
        .filter((d, i) => i !== 0)
        .reduce((total, day) => {
          const [sh, sm] = day.startTime.split(':').map(Number);
          const [eh, em] = day.endTime.split(':').map(Number);
          return total + (eh * 60 + em - (sh * 60 + sm));
        }, 0);
      expect(withBadDay).toBe(good);
    });

    it('replaces the published week on save', () => {
      session.saveSchedule([{ dayOfWeek: 1, enabled: true, startTime: '10:00', endTime: '13:00' }]);
      expect(session.schedule().length).toBe(1);
      expect(session.weeklyMinutes()).toBe(180);
    });
  });

  describe('profile', () => {
    it('starts from the signed-in doctor', () => {
      expect(session.profile().id).toBe(SIGNED_IN_DOCTOR_ID);
    });

    it('applies only the editable fields, leaving the licence alone', () => {
      const licence = session.profile().licenseNumber;
      session.updateProfile({
        name: 'R. Santos',
        email: 'new@mediq.ph',
        phone: '+63 900',
        bio: 'Hi',
      });
      expect(session.profile().name).toBe('R. Santos');
      expect(session.profile().licenseNumber).toBe(licence);
      expect(session.profile().specialization).toBe('Orthopedics');
    });
  });
});
