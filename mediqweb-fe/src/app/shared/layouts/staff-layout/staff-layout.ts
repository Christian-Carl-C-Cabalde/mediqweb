import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Avatar, Brand, Button, Modal } from '../../components';
import { StaffNav } from '../staff-nav/staff-nav';
import { StaffNavEntry, StaffNavItem } from '../staff-nav/staff-nav.types';
import { StaffCrumb, StaffProfile } from './staff-layout.types';

let nextId = 0;

/**
 * Application shell for signed-in staff: header, sidebar and content area.
 *
 * Deliberately knows nothing about authentication. It renders a `StaffProfile`
 * and emits `logout`, so guarding and session teardown stay with the route
 * layer and the future AuthService rather than being smuggled into the layout.
 *
 * The same `nav` array feeds the desktop sidebar and the mobile drawer, so a
 * role's menu is declared once and cannot drift between breakpoints.
 */
@Component({
  selector: 'app-staff-layout',
  imports: [RouterLink, Avatar, Brand, Button, Modal, StaffNav],
  templateUrl: './staff-layout.html',
  styleUrl: './staff-layout.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffLayout {
  readonly user = input.required<StaffProfile>();
  /** Per-role menu. Accepts a flat list or explicit groups. */
  readonly nav = input<readonly StaffNavEntry[]>([]);
  /** Highlights an item when it has no route of its own. */
  readonly activeItemId = input<string | null>(null);
  readonly pageTitle = input<string | null>(null);
  readonly breadcrumbs = input<readonly StaffCrumb[]>([]);
  /** Destination for the brand mark. */
  readonly brandLink = input('/');
  readonly showLogout = input(true);

  readonly logout = output<void>();
  readonly navSelected = output<StaffNavItem>();

  protected readonly navOpen = signal(false);
  protected readonly logoutConfirmOpen = signal(false);
  protected readonly mainId = `staff-main-${++nextId}`;

  protected onNavSelected(item: StaffNavItem): void {
    this.navSelected.emit(item);
    // Never leave the drawer covering the page the user just chose.
    this.navOpen.set(false);
  }

  protected closeNav(): void {
    this.navOpen.set(false);
  }

  /**
   * Asks before signing out instead of doing it.
   *
   * Signing out throws away whatever is in the form on screen, and the nav item
   * sits at the bottom of a long menu where it is easy to reach by muscle
   * memory rather than by intent. One click to ask, one to confirm.
   *
   * The drawer is closed first. It is how logout is reached on small screens,
   * and leaving it open would stack two dialogs in the top layer at once.
   */
  protected requestLogout(): void {
    this.navOpen.set(false);
    this.logoutConfirmOpen.set(true);
  }

  protected confirmLogout(): void {
    this.logoutConfirmOpen.set(false);
    this.logout.emit();
  }

  protected cancelLogout(): void {
    this.logoutConfirmOpen.set(false);
  }
}
