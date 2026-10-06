/**
 * MediQ shared component library.
 *
 * Every component is standalone and consumes only the design tokens declared
 * in `src/styles/_variables.scss`. Import from this barrel rather than from
 * individual files so call sites stay stable when files move.
 */

// Primitives
export { Brand } from './brand/brand';
export { Spinner } from './spinner/spinner';

// Containers
export { Card, type CardPadding, type CardVariant } from './card/card';
export { StatCard, type StatTone, type StatTrend } from './stat-card/stat-card';

// Forms
export { Button, type ButtonSize, type ButtonVariant } from './button/button';
export { FormField, type FormFieldState } from './form-field/form-field';
export {
  Dropdown,
  type DropdownItem,
  type DropdownPlacement,
  type DropdownSize,
} from './dropdown/dropdown';

// Listing chrome. Shared because every area that shows a filtered list needs
// the same search-and-filter bar, and because keeping one copy is what stops
// the areas' filter behaviour from drifting apart.
export { FilterBar } from './filter-bar/filter-bar';

// Data display
export { Avatar, type AvatarSize, type AvatarStatus } from './avatar/avatar';
export {
  StatusBadge,
  BADGE_TONE_TOKEN,
  type BadgeSize,
  type BadgeTone,
} from './status-badge/status-badge';
export { Table, type TableColumn, type TableSort, type SortDirection } from './table/table';
export { TableCell } from './table/table-cell';

// Shared by every staff area that reads a staff or patient record: the same
// fact/value grid, and one place that decides how an appointment status looks,
// so a `no-show` cannot be a different colour depending on which area you are in.
export { AppointmentStatusBadge } from './appointment-status/appointment-status';
export { DetailList } from './detail-list/detail-list';

// Overlays
export { Modal, type ModalPlacement, type ModalSize } from './modal/modal';

/**
 * Shared by every area because every area is currently backed by mock data.
 * The `area` input names the area so the wording does not drift.
 */
export { MockNotice } from './mock-notice/mock-notice';

/**
 * Prints the sample sign-ins on the login screen. Beside `MockNotice` rather
 * than part of it: that one says an area's data is sample data, this one says
 * which credentials that sample data accepts. Both are temporary and both go
 * when the API lands.
 */
export { SampleAccounts, type SampleAccount } from './sample-accounts/sample-accounts';
