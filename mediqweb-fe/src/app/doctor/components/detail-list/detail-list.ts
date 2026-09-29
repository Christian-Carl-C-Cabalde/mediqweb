import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { Card } from '../../../shared/components';
/**
 * A titled card wrapping a description list.
 *
 * Patient details and the profile page both present "here is a fact, here is
 * its value" pairs, and both need the same two-column definition-list grid.
 * Keeping the `<dl>` here means the pairs are marked up consistently and the
 * markup stays readable — `dt`/`dd` pairs are children, not string data, so a
 * value can still be a link or a badge.
 */
@Component({
  selector: 'doctor-detail-list',
  imports: [Card],
  templateUrl: './detail-list.html',
  styleUrl: './detail-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DetailList {
  readonly heading = input.required<string>();
}
