import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

export type CardVariant = 'outlined' | 'elevated' | 'filled';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

/**
 * Surface container for grouping related content.
 *
 * Named projection slots keep the header/footer optional without a wrapper
 * component at every call site:
 * ```html
 * <ui-card heading="Today's queue">
 *   <ng-container uiCardHeaderActions><ui-button>…</ui-button></ng-container>
 *   …
 *   <ng-container uiCardFooter>…</ng-container>
 * </ui-card>
 * ```
 * Empty header/footer collapse automatically via `:empty`.
 */
@Component({
  selector: 'ui-card',
  templateUrl: './card.html',
  styleUrl: './card.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.ui-card-host--interactive]': 'interactive()',
  },
})
export class Card {
  readonly variant = input<CardVariant>('outlined');
  readonly padding = input<CardPadding>('md');
  /** Adds hover affordance for clickable cards. */
  readonly interactive = input(false);
  /** Convenience heading; ignore it to project a custom header. */
  readonly heading = input<string | null>(null);
  readonly headingLevel = input<3 | 4>(3);

  readonly cardClick = output<MouseEvent>();

  protected onClick(event: MouseEvent): void {
    if (this.interactive()) this.cardClick.emit(event);
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.interactive()) return;
    if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
      // Space would otherwise scroll the page.
      event.preventDefault();
      this.cardClick.emit(event as unknown as MouseEvent);
    }
  }
}
