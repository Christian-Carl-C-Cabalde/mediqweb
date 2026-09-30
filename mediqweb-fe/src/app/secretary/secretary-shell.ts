import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { type ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { type DropdownItem } from '../shared/components';
import {
  StaffLayout,
  type StaffCrumb,
  type StaffNavEntry,
  type StaffProfile,
} from '../shared/layouts';
import { SecretarySession } from './secretary-session';

const DASHBOARD_ROUTE = '/secretary/dashboard';

/**
 * Secretary menu. Declared once and used for both the sidebar and the mobile
 * drawer, so the two cannot drift apart. Logout is not here: the layout always
 * renders it, because every role needs a way out.
 */
const SECRETARY_NAV: readonly StaffNavEntry[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', route: DASHBOARD_ROUTE },
  {
    id: 'appointments',
    label: 'Appointments',
    icon: 'calendar',
    route: '/secretary/appointments',
  },
  { id: 'patients', label: 'Patients', icon: 'users', route: '/secretary/patients' },
  { id: 'doctors', label: 'Doctors', icon: 'stethoscope', route: '/secretary/doctors' },
  { id: 'schedules', label: 'Schedules', icon: 'clipboard', route: '/secretary/schedules' },
  { id: 'profile', label: 'Profile', icon: 'settings', route: '/secretary/profile' },
];

const SECRETARY_PROFILE_MENU: DropdownItem[] = [
  { id: 'profile', label: 'My profile' },
  { id: 'password', label: 'Change password' },
];

/**
 * Route shell for the Secretary area.
 *
 * Mirrors the Doctor shell: it owns the layout, the menu and the identity, then
 * projects a `router-outlet` so every page is its own lazy chunk. It also
 * publishes `SecretarySession`, scoping the mock store to this branch of the app.
 *
 * The identity is read from the session rather than declared as a constant, so
 * editing the Profile page updates the name in the header. With a real AuthService
 * this becomes one read from the current user and nothing else changes.
 *
 * Page titles and breadcrumbs come from each route's `data.heading` rather than
 * from the page components, so a page never has to reach up to configure the
 * layout. For the same reason the layout's `[staffPageActions]` slot is not
 * available to pages: each page renders its own toolbar beneath the heading.
 */
@Component({
  selector: 'app-secretary-shell',
  imports: [RouterOutlet, StaffLayout],
  templateUrl: './secretary-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SecretarySession],
})
export class SecretaryShell {
  private readonly router = inject(Router);
  private readonly session = inject(SecretarySession);

  protected readonly user = computed<StaffProfile>(() => ({
    name: this.session.profile().name,
    role: 'Secretary',
  }));

  protected readonly nav = SECRETARY_NAV;
  protected readonly profileMenu = SECRETARY_PROFILE_MENU;

  /**
   * Navigation counter, bumped after every completed navigation.
   *
   * `routerState.snapshot` is a mutable object, not a signal, so a `computed`
   * reading it would cache its first result forever and the heading would never
   * change after the first page load. Reading the snapshot inside a computed
   * that also reads this counter makes the dependency explicit.
   */
  private readonly navCount = signal(0);

  /**
   * Heading of the deepest matched route that declares one, with the patient's
   * name substituted where the route asks for it.
   */
  protected readonly pageTitle = computed(() => {
    this.navCount();
    const route = this.deepestRoute();
    const heading = route?.data?.['heading'];
    const fallback = typeof heading === 'string' && heading.length ? heading : null;
    return route?.data?.['headingFromPatient'] ? this.patientHeading(fallback) : fallback;
  });

  protected readonly breadcrumbs = computed<StaffCrumb[]>(() => {
    const heading = this.pageTitle();
    // The layout renders the final crumb as plain text, never as a link.
    return heading ? [{ label: 'Dashboard', route: DASHBOARD_ROUTE }, { label: heading }] : [];
  });

  constructor() {
    // Navigation *end*, not start, so the snapshot already points at the new
    // route by the time the heading is recomputed.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.navCount.update((n) => n + 1));
  }

  /**
   * The layout emits logout but has no session to clear. Returning to sign-in
   * is the honest behaviour until authentication exists; calling the future
   * AuthService here instead is a one-line change.
   */
  protected onLogout(): void {
    void this.router.navigate(['/login']);
  }

  /**
   * The deepest matched route that declares a heading.
   *
   * Returns the route rather than the heading so the caller can also read the
   * other `data` flags the routes declare.
   */
  private deepestRoute(): ActivatedRouteSnapshot | null {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let deepest: ActivatedRouteSnapshot | null = null;
    while (route) {
      if (typeof route.data?.['heading'] === 'string' && route.data['heading'].length) {
        deepest = route;
      }
      route = route.firstChild;
    }
    return deepest;
  }

  /**
   * The patient's name, for the details page heading.
   *
   * An id that matches nobody falls back to the route's own heading rather than
   * rendering "undefined" — the page body then explains that the record does not
   * exist, and the title does not have to.
   */
  private patientHeading(fallback: string | null): string {
    const route = this.deepestRoute();
    const id = route?.paramMap.get('id');
    return (id ? this.session.patientById(id)?.name : null) ?? fallback ?? 'Patient';
  }
}
