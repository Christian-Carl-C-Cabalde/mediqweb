import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { from, of, switchMap } from 'rxjs';
import { type ActivatedRouteSnapshot, NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import {
  StaffLayout,
  type StaffCrumb,
  type StaffNavEntry,
  type StaffProfile,
} from '../shared/layouts';
import { AdminSession } from './admin-session';
import { SupabaseService } from '../core/api/supabase.service';

const DASHBOARD_ROUTE = '/admin/dashboard';

/**
 * Admin menu. Declared once and used for both the sidebar and the mobile
 * drawer, so the two cannot drift apart.
 */
const ADMIN_NAV: readonly StaffNavEntry[] = [
  { id: 'dashboard', label: 'Dashboard', icon: 'dashboard', route: DASHBOARD_ROUTE },
  {
    id: 'accounts',
    label: 'Accounts',
    items: [
      { id: 'doctors', label: 'Doctors', icon: 'users', route: '/admin/accounts/doctors' },
      {
        id: 'secretaries',
        label: 'Secretaries',
        icon: 'users',
        route: '/admin/accounts/secretaries',
      },
      { id: 'patients', label: 'Patients', icon: 'users', route: '/admin/accounts/patients' },
    ],
  },
  {
    id: 'management',
    label: 'Management',
    items: [
      {
        id: 'specializations',
        label: 'Specialties',
        icon: 'folder',
        route: '/admin/specializations',
      },
    ],
  },
  {
    id: 'system',
    label: 'System',
    items: [
      { id: 'audit-logs', label: 'Audit Logs', icon: 'clipboard', route: '/admin/audit-logs' },
      { id: 'settings', label: 'Settings', icon: 'settings', route: '/admin/settings' },
    ],
  },
];

/**
 * Route shell for the Admin area.
 *
 * Owns the layout, the menu and the identity, then projects a `router-outlet`
 * so every Admin page is its own lazy chunk. It also publishes `AdminSession`
 * for the pages, scoping the mock store to this branch of the app.
 *
 * Page titles and breadcrumbs come from each route's `data.heading` rather than
 * from the page components. That keeps a page's heading declared next to its
 * route, and means a page never has to reach up to configure the layout.
 *
 * The layout's `[staffPageActions]` slot is unavailable to pages for the same
 * reason: the layout is owned here, not by the page. Each page therefore
 * renders its own toolbar beneath the heading.
 */
@Component({
  selector: 'app-admin-shell',
  imports: [RouterOutlet, StaffLayout],
  templateUrl: './admin-shell.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminSession],
})
export class AdminShell {
  private readonly router = inject(Router);
  private readonly supabase = inject(SupabaseService);

  protected user: StaffProfile = { name: 'Administrator', role: 'ADMIN' };
  protected readonly nav = ADMIN_NAV;

  /**
   * Navigation counter, bumped after every completed navigation.
   *
   * `routerState.snapshot` is a mutable object, not a signal, so a `computed`
   * reading it would cache its first result forever and the heading would never
   * change after the first page load. Reading the snapshot inside a computed
   * that also reads this counter makes the dependency explicit.
   */
  private readonly navCount = signal(0);

  /** Heading of the deepest matched route that declares one. */
  protected readonly pageTitle = computed(() => {
    this.navCount();
    return this.deepestHeading();
  });

  protected readonly breadcrumbs = computed<StaffCrumb[]>(() => {
    const heading = this.pageTitle();
    // The layout renders the final crumb as plain text, never as a link.
    return heading ? [{ label: 'Dashboard', route: DASHBOARD_ROUTE }, { label: heading }] : [];
  });

  constructor() {
    // Load the signed-in admin's profile from Supabase so the shell shows
    // real name and role instead of a placeholder.
    from(this.supabase.getUser()).pipe(
      switchMap((result: any) => {
        if (result.error || !result.data?.user) {
          this.user = { name: 'Administrator', role: 'ADMIN' };
          return of(null);
        }
        return from(
          this.supabase
            .from('profiles')
            .select('full_name, email, role')
            .eq('user_id', result.data.user.id)
            .single(),
        );
      }),
    ).subscribe({
      next: (profileResult: any) => {
        if (!profileResult?.data) return;
        this.user = {
          name: profileResult.data.full_name || 'Administrator',
          role: profileResult.data.role || 'ADMIN',
          email: profileResult.data.email,
        };
      },
      error: () => {
        this.user = { name: 'Administrator', role: 'ADMIN' };
      },
    });

    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.navCount.update((n: number) => n + 1));
  }

  /**
   * The layout emits logout but has no session to clear. Returning to sign-in
   * is the honest behaviour until authentication exists; calling the future
   * AuthService here instead is a one-line change.
   */
  protected onLogout(): void {
    void this.router.navigate(['/login']);
  }

  private deepestHeading(): string | null {
    let route: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let heading: string | null = null;
    while (route) {
      const declared = route.data?.['heading'];
      if (typeof declared === 'string' && declared.length) heading = declared;
      route = route.firstChild;
    }
    return heading;
  }
}
