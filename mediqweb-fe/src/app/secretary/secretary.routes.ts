import type { Routes } from '@angular/router';

/**
 * Secretary area routes.
 *
 * Every page is its own lazy chunk. `data.heading` is what the shell reads to
 * fill in the layout's page title and breadcrumb, so a page never configures
 * the layout itself.
 *
 * The patient details heading is a special case: it should name the patient, not
 * the word "patient", and a name cannot be known until the id is in the URL. A
 * route resolver is the usual answer, but Angular skips resolution entirely when
 * no route on the tree declares a guard, so a resolver here would silently do
 * nothing. `headingFromPatient` instead tells the shell to fill the heading in
 * from the record, which always runs and cannot be left half-wired.
 */
export const SECRETARY_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./secretary-shell').then((m) => m.SecretaryShell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Secretary Dashboard · MediQ',
        data: { heading: 'Secretary Dashboard' },
        loadComponent: () =>
          import('./pages/secretary-dashboard/secretary-dashboard').then(
            (m) => m.SecretaryDashboard,
          ),
      },
      {
        path: 'appointments',
        title: 'Appointments · Secretary · MediQ',
        data: { heading: 'Appointments' },
        loadComponent: () =>
          import('./pages/secretary-appointments/secretary-appointments').then(
            (m) => m.SecretaryAppointments,
          ),
      },
      {
        path: 'patients',
        title: 'Patients · Secretary · MediQ',
        data: { heading: 'Patients' },
        loadComponent: () =>
          import('./pages/secretary-patients/secretary-patients').then((m) => m.SecretaryPatients),
      },
      {
        path: 'patients/:id',
        title: 'Patient · Secretary · MediQ',
        data: { heading: 'Patient', headingFromPatient: true },
        loadComponent: () =>
          import('./pages/secretary-patient-details/secretary-patient-details').then(
            (m) => m.SecretaryPatientDetails,
          ),
      },
      {
        path: 'doctors',
        title: 'Doctors · Secretary · MediQ',
        data: { heading: 'Doctors' },
        loadComponent: () =>
          import('./pages/secretary-doctors/secretary-doctors').then((m) => m.SecretaryDoctors),
      },
      {
        // `doctors` and `schedules` are siblings rather than nested: a Secretary is
        // assigned one doctor, so the schedules page is that doctor's published
        // week and the roster page is the same person with their booking figures.
        // Nesting the schedule under `doctors/:id` would be a second route to keep
        // in step with no reader who needs it — there is only one doctor here.
        path: 'schedules',
        title: 'Schedules · Secretary · MediQ',
        data: { heading: 'Schedules' },
        loadComponent: () =>
          import('./pages/secretary-schedules/secretary-schedules').then(
            (m) => m.SecretarySchedules,
          ),
      },
      {
        path: 'messages',
        title: 'Messages · Secretary · MediQ',
        data: { heading: 'Messages' },
        loadComponent: () =>
          import('./pages/secretary-messages/secretary-messages').then((m) => m.SecretaryMessages),
      },
      {
        path: 'profile',
        title: 'My Profile · Secretary · MediQ',
        data: { heading: 'My Profile' },
        loadComponent: () =>
          import('./pages/secretary-profile/secretary-profile').then((m) => m.SecretaryProfilePage),
      },
    ],
  },
];
