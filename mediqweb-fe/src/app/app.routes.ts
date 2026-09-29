import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · MediQ',
    loadComponent: () => import('./auth/pages/staff-login/staff-login').then((m) => m.StaffLogin),
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'admin',
    loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  // Temporary: every unknown route lands on sign-in until the remaining role
  // areas exist. Replace with a real not-found page.
  { path: '**', redirectTo: 'login' },
];
