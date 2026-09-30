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
        // `doctors` and `schedules` are siblings rather than nested: the schedules
        // page shows every doctor's week side by side, which is how a Secretary
        // reads them when answering "who is free on Thursday?". Nesting it under
        // `doctors/:id` would mean an extra click for the common case and a
        // second route to keep in step.
        path: 'schedules',
        title: 'Schedules · Secretary · MediQ',
        data: { heading: 'Schedules' },
        loadComponent: () =>
          import('./pages/secretary-schedules/secretary-schedules').then(
            (m) => m.SecretarySchedules,
          ),
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
