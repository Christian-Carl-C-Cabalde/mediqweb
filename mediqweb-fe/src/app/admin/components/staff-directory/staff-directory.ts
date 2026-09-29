import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  Avatar,
  Button,
  Card,
  Dropdown,
  FormField,
  Modal,
  StatusBadge,
  Table,
  TableCell,
  type BadgeTone,
  type DropdownItem,
  type TableColumn,
} from '../../../shared/components';
import { AdminSession, type StaffKind } from '../../admin-session';
import { FilterBar } from '../filter-bar/filter-bar';
import { MockNotice } from '../mock-notice/mock-notice';
import type { AccountStatus, StaffAccount } from '../../admin.models';

type StatusFilter = 'all' | AccountStatus;

const STATUS_FILTER_ITEMS: DropdownItem[] = [
  { id: 'all', label: 'All statuses' },
  { id: 'active', label: 'Active' },
  { id: 'inactive', label: 'Inactive' },
];

/**
 * Account directory for doctors and secretaries.
 *
 * Both roles need the same thing — a searchable list, a way to enable or
 * disable an account, and a form to add one — and differ only in a couple of
 * columns, so they share this component and pass a `kind`. Splitting them into
 * two near-identical pages would guarantee the two drift apart.
 *
 * UI only: "adding" an account appends to the in-memory `AdminSession`.
 */
@Component({
  selector: 'admin-staff-directory',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    Avatar,
    Button,
    Card,
    Dropdown,
    FormField,
    Modal,
    StatusBadge,
    Table,
    TableCell,
    FilterBar,
    MockNotice,
  ],
  templateUrl: './staff-directory.html',
  styleUrl: './staff-directory.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffDirectory {
  private readonly fb = inject(FormBuilder);
  protected readonly session = inject(AdminSession);

  readonly kind = input.required<StaffKind>();

  protected readonly query = signal('');
  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly createOpen = signal(false);
  protected readonly saving = signal(false);
  protected readonly confirmDisableFor = signal<StaffAccount | null>(null);
  protected readonly notice = signal<string | null>(null);

  // ---------------------------------------------------------------------------
  // Wording — everything role-specific is derived from `kind`
  // ---------------------------------------------------------------------------
  protected readonly singular = computed(() => (this.kind() === 'doctor' ? 'doctor' : 'secretary'));
  protected readonly plural = computed(() =>
    this.kind() === 'doctor' ? 'Doctors' : 'Secretaries',
  );
  protected readonly statusOptions = STATUS_FILTER_ITEMS;

  protected readonly columns = computed<TableColumn<StaffAccount>[]>(() => {
    const base: TableColumn<StaffAccount>[] = [
      { key: 'name', header: 'Name', sortable: true },
      { key: 'email', header: 'Email', sortable: true, hideBelow: 'lg' },
    ];
    if (this.kind() === 'doctor') {
      base.push(
        { key: 'specialization', header: 'Specialization', hideBelow: 'md' },
        { key: 'licenseNumber', header: 'License', hideBelow: 'lg' },
      );
    }
    base.push(
      { key: 'status', header: 'Status', sortable: true },
      { key: 'joinedOn', header: 'Joined', sortable: true, hideBelow: 'md' },
      { key: 'actions', header: 'Actions', align: 'end' },
    );
    return base;
  });

  // ---------------------------------------------------------------------------
  // Rows
  // ---------------------------------------------------------------------------
  protected readonly accounts = computed(() => {
    const term = this.query().trim().toLowerCase();
    const status = this.statusFilter();
    return this.session
      .staffOf(this.kind())
      .filter((account) => status === 'all' || account.status === status)
      .filter((account) => {
        if (!term) return true;
        return [account.name, account.email, account.licenseNumber ?? ''].some((field) =>
          field.toLowerCase().includes(term),
        );
      })
      .map((account) => ({
        ...account,
        // Denormalised for the table so the default cell renderer can read them.
        specialization: this.session.specializationName(account.specializationId),
      }));
  });

  protected readonly activeCount = computed(
    () => this.session.staffOf(this.kind()).filter((a) => a.status === 'active').length,
  );
  protected readonly totalCount = computed(() => this.session.staffOf(this.kind()).length);

  // ---------------------------------------------------------------------------
  // Create form
  // ---------------------------------------------------------------------------
  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', [Validators.required]],
    lastName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    // Both of these are doctor-only fields, so they carry no static validator:
    // a `required` on a control that is hidden for secretaries would make the
    // form unsaveable for them. `submit` checks them by role instead.
    specializationId: [''],
    licenseNumber: [''],
  });

  protected readonly specializationItems = computed(() =>
    this.session.specializationOptions().map((o) => ({ id: o.id, label: o.label })),
  );

  protected errorFor(control: 'firstName' | 'lastName' | 'email'): string | null {
    const field = this.form.controls[control];
    if (!field.touched) return null;
    if (field.hasError('required')) return 'This field is required.';
    if (field.hasError('email')) return 'Enter a valid email address.';
    return null;
  }

  /**
   * Required for doctors, irrelevant for secretaries, so it is checked by role.
   *
   * A method rather than a `computed`: it reads `control.touched`, which a
   * `markAsTouched()` call mutates without notifying any signal, so a computed
   * would keep returning its first result and the error would never appear.
   */
  protected specializationError(): string | null {
    if (this.kind() !== 'doctor') return null;
    const field = this.form.controls.specializationId;
    if (!field.touched) return null;
    return field.value ? null : 'Choose a specialization.';
  }

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------
  protected openCreate(): void {
    this.form.reset();
    this.createOpen.set(true);
  }

  protected closeCreate(): void {
    this.createOpen.set(false);
  }

  protected onStatusFilterChange(item: DropdownItem): void {
    this.statusFilter.set(item.id as StatusFilter);
  }

  protected statusTone(status: AccountStatus): BadgeTone {
    return status === 'active' ? 'success' : 'neutral';
  }

  protected onSpecializationChange(item: DropdownItem): void {
    this.form.controls.specializationId.setValue(item.id);
    this.form.controls.specializationId.markAsTouched();
  }

  protected submit(): void {
    const missingSpecialization =
      this.kind() === 'doctor' && !this.form.controls.specializationId.value;
    if (this.form.invalid || missingSpecialization) {
      this.form.markAllAsTouched();
      // The dropdown is not a real form control, so `markAllAsTouched` already
      // covers it — this only documents that the check is deliberate.
      return;
    }

    this.saving.set(true);
    const { firstName, lastName, email, specializationId, licenseNumber } = this.form.getRawValue();

    const created = this.session.addStaffAccount(this.kind(), {
      firstName,
      lastName,
      email,
      // Secretaries have no specialization, so ignore the hidden field for them.
      specializationId: this.kind() === 'doctor' ? specializationId : null,
      licenseNumber: this.kind() === 'doctor' ? licenseNumber : null,
    });

    this.saving.set(false);
    this.createOpen.set(false);
    this.notice.set(`Created ${created.name}'s ${this.singular()} account.`);
  }

  protected requestDisable(account: StaffAccount): void {
    this.confirmDisableFor.set(account);
  }

  protected cancelDisable(): void {
    this.confirmDisableFor.set(null);
  }

  protected confirmDisable(): void {
    const account = this.confirmDisableFor();
    if (!account) return;
    this.session.setStaffStatus(this.kind(), account.id, 'inactive');
    this.confirmDisableFor.set(null);
    this.notice.set(`${account.name} can no longer sign in.`);
  }

  protected enable(account: StaffAccount): void {
    this.session.setStaffStatus(this.kind(), account.id, 'active');
    this.notice.set(`${account.name} can sign in again.`);
  }
}
