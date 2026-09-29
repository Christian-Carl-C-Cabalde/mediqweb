import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { StaffNavEntry, StaffNavGroup, StaffNavIcon, StaffNavItem } from './staff-nav.types';

/** 24x24 stroked paths. Kept here so consumers configure an icon by name. */
const ICON_PATHS: Record<StaffNavIcon, string> = {
  dashboard: 'M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z',
  users:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75',
  calendar:
    'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z',
  folder:
    'M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z',
  settings: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
};

/**
 * Sidebar / drawer navigation list.
 *
 * Rendered twice by `app-staff-layout` — once in the desktop sidebar and once
 * inside the mobile drawer — so the per-role menu is declared once by the
 * caller and stays in sync across breakpoints.
 */
@Component({
  selector: 'app-staff-nav',
  imports: [NgTemplateOutlet, RouterLink, RouterLinkActive],
  templateUrl: './staff-nav.html',
  styleUrl: './staff-nav.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffNav {
  /** Accepts a flat item list or explicit groups; both are normalised here. */
  readonly nav = input<readonly StaffNavEntry[]>([]);
  /** Highlights an item when it has no route to match against. */
  readonly activeId = input<string | null>(null);
  readonly ariaLabel = input('Main');
  /** Every role needs a way out, so logout is not part of the configurable list. */
  readonly showLogout = input(true);
  readonly logoutLabel = input('Logout');

  readonly itemSelected = output<StaffNavItem>();
  readonly logout = output<void>();

  protected readonly groups = computed<StaffNavGroup[]>(() =>
    this.nav().map((entry, index) => ('items' in entry ? entry : { id: entry.id, items: [entry] })),
  );

  protected iconPath(icon: StaffNavIcon | undefined): string | null {
    return icon ? ICON_PATHS[icon] : null;
  }

  protected select(item: StaffNavItem): void {
    if (item.disabled) return;
    this.itemSelected.emit(item);
  }
}
