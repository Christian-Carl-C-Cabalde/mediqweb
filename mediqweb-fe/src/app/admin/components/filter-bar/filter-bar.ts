import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { FormField } from '../../../shared/components';

let nextId = 0;

/**
 * Search box plus a slot for extra filters, shared by every Admin list page.
 *
 * The field is a plain view over a query string rather than a form control, so
 * a page can hold the term in a signal and filter with it. Projected controls
 * sit in the second column and wrap on narrow screens.
 */
@Component({
  selector: 'admin-filter-bar',
  imports: [FormField],
  templateUrl: './filter-bar.html',
  styleUrl: './filter-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterBar {
  /** Accessible name for the search field. */
  readonly label = input.required<string>();
  readonly placeholder = input('Search');
  readonly value = input('');

  readonly queryChange = output<string>();

  protected readonly controlId = `admin-filter-${++nextId}`;

  protected onInput(event: Event): void {
    this.queryChange.emit((event.target as HTMLInputElement).value);
  }
}
