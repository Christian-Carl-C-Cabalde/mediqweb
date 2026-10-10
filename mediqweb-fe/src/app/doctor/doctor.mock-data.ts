import { localIso } from './doctor.dates';
import type { Appointment, DoctorProfile, Patient, ScheduleDay } from './doctor.models';

/**
 * Sample data standing in for the Doctor API.
 *
 * Obvious placeholder values in one file, so the whole set is trivial to delete
 * when the real endpoints land. Names are plainly fictional and no record
 * carries a real identifier.
 *
 * This is a *separate* cohort from `admin.mock-data.ts`, on purpose. The Admin
 * area and the Doctor area are independent stores with different views of a
 * patient — an account row versus a person with a visit history — and a
 * doctor only ever sees patients who have an appointment with them. Sharing one
 * set of fixtures would have meant the Doctor area importing from the Admin
 * area, or the Doctor being shown patients who have never booked with them.
 * When `DoctorSession` and `AdminSession` are replaced by services, the question
 * disappears.
 *
 * Two consequences worth knowing while reading the pages:
 * - `appt-117` belongs to another doctor and is the reason the Patient List is
 *   shorter than the patient table; it proves the scoping actually filters.
 * - Dates are relative to the day this module is first imported, so the
 *   dashboard always has a populated "today".
 */

/** The signed-in doctor. Fixed until authentication exists. */
export const SIGNED_IN_DOCTOR_ID = 'doc-002';

/**
 * A timestamp `daysFromToday` days from now at `hour:minute` local time.
 *
 * Evaluated once at import so the fixtures are a stable set rather than a
 * moving target, which keeps the dashboard meaningful without a clock.
 */
function at(daysFromToday: number, hour: number, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromToday);
  date.setHours(hour, minute, 0, 0);
  return localIso(date);
}

export const MOCK_DOCTOR_PROFILE: DoctorProfile = {
  id: SIGNED_IN_DOCTOR_ID,
  name: 'Rafael Santos',
  email: 'rafael.santos@mediq.ph',
  specialization: 'Orthopedics',
  licenseNumber: 'PRC-120913',
  joinedOn: '2026-01-19',
  bio: 'Orthopedic surgeon focused on sports injuries and post-operative rehabilitation.',
};

export const MOCK_PATIENTS: readonly Patient[] = [
  {
    id: 'pat-101',
    name: 'Juan Dela Cruz',
    email: 'juan.delacruz@example.ph',
    phone: '+63 917 555 0301',
    dateOfBirth: '1986-03-14',
    address: '24 Katipunan Ave, Quezon City',
    registeredOn: '2025-11-12',
    status: 'active',
  },
  {
    id: 'pat-102',
    name: 'Maria Santos',
    email: 'maria.santos@example.ph',
    phone: '+63 918 555 0322',
    dateOfBirth: '1994-11-02',
    address: '8 Aurelio St, Mandaluyong',
    registeredOn: '2026-01-08',
    status: 'active',
  },
  {
    id: 'pat-103',
    name: 'Pedro Reyes',
    email: 'pedro.reyes@example.ph',
    phone: '+63 919 555 0343',
    dateOfBirth: '1978-06-25',
    address: '115 Shaw Blvd, Mandaluyong',
    registeredOn: '2026-02-14',
    status: 'active',
  },
  {
    id: 'pat-104',
    name: 'Ana Bautista',
    email: 'ana.bautista@example.ph',
    phone: '+63 917 555 0364',
    dateOfBirth: '2011-09-08',
    address: '3 Pelaez St, Manila',
    registeredOn: '2026-03-21',
    status: 'active',
  },
  {
    id: 'pat-105',
    name: 'Miguel Torres',
    email: 'miguel.torres@example.ph',
    phone: '+63 918 555 0385',
    dateOfBirth: '1999-01-30',
    address: '77 San Juan St, Makati',
    registeredOn: '2026-04-02',
    status: 'active',
  },
  {
    id: 'pat-106',
    name: 'Lucia Mendoza',
    email: 'lucia.mendoza@example.ph',
    phone: '+63 919 555 0406',
    dateOfBirth: '1965-07-19',
    address: '42 Taft Ave, Pasay',
    registeredOn: '2025-10-27',
    status: 'active',
  },
  {
    id: 'pat-107',
    name: 'Rafael Aquino',
    email: 'rafael.aquino@example.ph',
    phone: '+63 917 555 0427',
    dateOfBirth: '1982-12-05',
    address: '9 Kalachuchi St, Quezon City',
    registeredOn: '2025-12-15',
    status: 'inactive',
  },
  {
    id: 'pat-108',
    name: 'Carla De Guzman',
    email: 'carla.deguzman@example.ph',
    phone: '+63 918 555 0448',
    dateOfBirth: '2001-04-22',
    address: '61 Katipunan Ave, Quezon City',
    registeredOn: '2026-05-06',
    status: 'active',
  },
  {
    id: 'pat-109',
    name: 'Andres Salazar',
    email: 'andres.salazar@example.ph',
    phone: '+63 919 555 0469',
    dateOfBirth: '1972-02-28',
    address: '15 Roxas Blvd, Pasig',
    registeredOn: '2025-09-30',
    status: 'active',
  },
  {
    id: 'pat-110',
    name: 'Cristina Abel',
    email: 'cristina.abel@example.ph',
    phone: '+63 917 555 0480',
    dateOfBirth: '1990-08-16',
    address: '28 Timog Ave, Quezon City',
    registeredOn: '2026-06-18',
    status: 'active',
  },
  {
    id: 'pat-111',
    name: 'Elena Villanueva',
    email: 'elena.villanueva@example.ph',
    phone: '+63 918 555 0501',
    dateOfBirth: '1988-05-11',
    address: '5 Legazpi St, Makati',
    registeredOn: '2026-07-23',
    status: 'active',
  },
  {
    id: 'pat-112',
    name: 'Nestor Yulo',
    email: 'nestor.yulo@example.ph',
    phone: '+63 919 555 0522',
    dateOfBirth: '1975-10-02',
    address: '34 Commonwealth Ave, Quezon City',
    registeredOn: '2026-08-11',
    status: 'active',
  },
  {
    // Only ever booked with another doctor, so the Doctor area must not show
    // this patient or their appointment.
    id: 'pat-113',
    name: 'Danilo Puno',
    email: 'danilo.puno@example.ph',
    phone: '+63 917 555 0543',
    dateOfBirth: '1984-09-27',
    address: '12 Luna St, Mandaue',
    registeredOn: '2026-02-03',
    status: 'active',
  },
];

const ME = SIGNED_IN_DOCTOR_ID;

export const MOCK_APPOINTMENTS: readonly Appointment[] = [
  // Today
  {
    id: 'appt-101',
    patientId: 'pat-101',
    doctorId: ME,
    startsAt: at(0, 9, 0),
    durationMinutes: 45,
    status: 'confirmed',
    reason: 'Follow-up: knee rehabilitation',
  },
  {
    id: 'appt-102',
    patientId: 'pat-102',
    doctorId: ME,
    startsAt: at(0, 10, 0),
    durationMinutes: 30,
    status: 'booked',
    reason: 'Post-operative review',
  },
  {
    id: 'appt-103',
    patientId: 'pat-103',
    doctorId: ME,
    startsAt: at(0, 11, 0),
    durationMinutes: 45,
    status: 'confirmed',
    reason: 'New patient: shoulder pain',
  },
  {
    id: 'appt-104',
    patientId: 'pat-104',
    doctorId: ME,
    startsAt: at(0, 13, 30),
    durationMinutes: 30,
    status: 'booked',
    reason: 'Splint adjustment',
  },
  {
    id: 'appt-105',
    patientId: 'pat-105',
    doctorId: ME,
    startsAt: at(0, 15, 0),
    durationMinutes: 45,
    status: 'booked',
    reason: 'Second opinion on imaging',
  },
  // Yesterday
  {
    id: 'appt-106',
    patientId: 'pat-106',
    doctorId: ME,
    startsAt: at(-1, 9, 0),
    durationMinutes: 45,
    status: 'completed',
    reason: 'Knee rehabilitation review',
  },
  {
    id: 'appt-107',
    patientId: 'pat-107',
    doctorId: ME,
    startsAt: at(-1, 10, 30),
    durationMinutes: 30,
    status: 'completed',
    reason: 'Post-operative review',
  },
  {
    id: 'appt-108',
    patientId: 'pat-108',
    doctorId: ME,
    startsAt: at(-1, 14, 0),
    durationMinutes: 45,
    status: 'cancelled',
    reason: 'Follow-up: shoulder mobility',
  },
  // Earlier this month
  {
    id: 'appt-109',
    patientId: 'pat-109',
    doctorId: ME,
    startsAt: at(-4, 9, 30),
    durationMinutes: 45,
    status: 'completed',
    reason: 'New patient: wrist pain',
  },
  {
    id: 'appt-110',
    patientId: 'pat-110',
    doctorId: ME,
    startsAt: at(-4, 11, 0),
    durationMinutes: 45,
    status: 'no-show',
    reason: 'Knee rehabilitation review',
  },
  {
    id: 'appt-111',
    patientId: 'pat-101',
    doctorId: ME,
    startsAt: at(-12, 10, 0),
    durationMinutes: 45,
    status: 'completed',
    reason: 'Knee rehabilitation review',
  },
  {
    id: 'appt-112',
    patientId: 'pat-105',
    doctorId: ME,
    startsAt: at(-12, 14, 30),
    durationMinutes: 45,
    status: 'completed',
    reason: 'Second opinion on imaging',
  },
  // Coming up
  {
    id: 'appt-113',
    patientId: 'pat-111',
    doctorId: ME,
    startsAt: at(1, 9, 0),
    durationMinutes: 45,
    status: 'booked',
    reason: 'Follow-up: shoulder mobility',
  },
  {
    id: 'appt-114',
    patientId: 'pat-112',
    doctorId: ME,
    startsAt: at(1, 11, 0),
    durationMinutes: 45,
    status: 'confirmed',
    reason: 'New patient: lower back pain',
  },
  {
    id: 'appt-115',
    patientId: 'pat-108',
    doctorId: ME,
    startsAt: at(2, 10, 0),
    durationMinutes: 30,
    status: 'confirmed',
    reason: 'Follow-up: shoulder mobility',
  },
  {
    id: 'appt-116',
    patientId: 'pat-106',
    doctorId: ME,
    startsAt: at(3, 9, 0),
    durationMinutes: 45,
    status: 'booked',
    reason: 'Knee rehabilitation review',
  },
  {
    // Another doctor's appointment. The Doctor area filters it out; the Patient
    // List is therefore shorter than `MOCK_PATIENTS`.
    id: 'appt-117',
    patientId: 'pat-113',
    doctorId: 'doc-001',
    startsAt: at(0, 16, 0),
    durationMinutes: 30,
    status: 'confirmed',
    reason: 'Cardiology consultation',
  },
];

/** Monday–Friday mornings and afternoons, plus a Saturday morning clinic. */
export const MOCK_SCHEDULE: readonly ScheduleDay[] = [
  { dayOfWeek: 0, enabled: false, startTime: '09:00', endTime: '12:00' },
  { dayOfWeek: 1, enabled: true, startTime: '09:00', endTime: '12:00' },
  { dayOfWeek: 2, enabled: true, startTime: '09:00', endTime: '12:00' },
  { dayOfWeek: 3, enabled: true, startTime: '13:00', endTime: '17:00' },
  { dayOfWeek: 4, enabled: true, startTime: '09:00', endTime: '12:00' },
  { dayOfWeek: 5, enabled: true, startTime: '09:00', endTime: '12:00' },
  { dayOfWeek: 6, enabled: true, startTime: '08:00', endTime: '11:00' },
];
