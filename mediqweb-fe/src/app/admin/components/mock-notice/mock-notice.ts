import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * States plainly that the Admin area is showing sample data.
 *
 * Every screen in this area is backed by `AdminSession`, which is an in-memory
 * mock. Without this notice a screenshot of the Admin area is indistinguishable
 * from a working product, which is exactly the impression to avoid while there
 * is no API behind it.
 */
@Component({
  selector: 'admin-mock-notice',
  templateUrl: './mock-notice.html',
  styleUrl: './mock-notice.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MockNotice {}
