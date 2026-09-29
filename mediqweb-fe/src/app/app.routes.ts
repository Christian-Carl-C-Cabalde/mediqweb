import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · MediQ',
    loadComponent: () => import('./auth/pages/staff-login/staff-login').then((m) => m.StaffLogin),
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  // Temporary: every unknown route lands on sign-in until the staff layout
  // and the role dashboards exist. Replace with a real not-found page.
  { path: '**', redirectTo: 'login' },
];
