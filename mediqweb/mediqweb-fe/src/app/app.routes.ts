import { Routes } from '@angular/router';

import { authGuard } from './core/auth.guard';
import { roleGuard } from './core/api/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · MediQ',
    loadComponent: () => import('./auth/pages/staff-login/staff-login').then((m) => m.StaffLogin),
  },
  {
    path: 'signup',
    title: 'Create account · MediQ',
    loadComponent: () => import('./auth/pages/auth-signup/auth-signup').then((m) => m.AuthSignup),
  },
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard('admin')],
    loadChildren: () => import('./admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: 'doctor',
    canActivate: [authGuard, roleGuard('doctor')],
    loadChildren: () => import('./doctor/doctor.routes').then((m) => m.DOCTOR_ROUTES),
  },
  {
    path: 'secretary',
    canActivate: [authGuard, roleGuard('secretary')],
    loadChildren: () => import('./secretary/secretary.routes').then((m) => m.SECRETARY_ROUTES),
  },
  // Temporary: every unknown route lands on sign-in until the remaining role
  // areas exist. Replace with a real not-found page.
  { path: '**', redirectTo: 'login' },
];
