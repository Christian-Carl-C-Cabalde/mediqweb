import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import {
  FormArray,
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Button, Card, FormField, MockNotice } from '../../../shared/components';
import { formatDuration, minutesOfDay } from '../../doctor.dates';
import { DoctorSession } from '../../doctor-session';
import type { ScheduleDay } from '../../doctor.models';

/** Sunday first, matching `Date.prototype.getDay()` and the fixture order. */
const DAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
] as const;

/** One group per day, so a day's hours are validated as a unit. */
type DayForm = FormGroup<{
  enabled: FormControl<boolean>;
  startTime: FormControl<string>;
  endTime: FormControl<string>;
}>;

/**
 * A closed day has no hours to check, so the end-after-start rule only applies
 * when the day is on. Getting this wrong would make an unused Sunday block the
 * form while looking completely valid.
 *
 * An empty or unparsable time belongs to `Validators.required`; reporting "end
 * before start" for a blank field would be a lie about what is wrong.
 */
const startBeforeEnd: ValidatorFn = (control): ValidationErrors | null => {
  const group = control as FormGroup;
  if (!group.get('enabled')?.value) return null;

  const start = minutesOfDay(String(group.get('startTime')?.value ?? ''));
  const end = minutesOfDay(String(group.get('endTime')?.value ?? ''));
  if (start === null || end === null) return null;

  return end > start ? null : { endBeforeStart: true };
};

/**
 * Weekly availability.
 *
 * The doctor publishes the hours a Secretary may book into. The form is filled
 * from the store and only written back on save, so leaving a half-finished edit
 * never touches the published week.
 *
 * Per-day time inputs rather than one "clinic hours" pair: most doctors work a
 * split day, and a single pair would make a morning-and-afternoon week
 * impossible to express.
 */
@Component({
  selector: 'app-doctor-schedule',
  imports: [ReactiveFormsModule, Button, Card, FormField, MockNotice],
  templateUrl: './doctor-schedule.html',
  styleUrl: './doctor-schedule.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DoctorSchedule {
  private readonly session = inject(DoctorSession);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly notice = signal<string | null>(null);

  protected readonly dayNames = DAY_NAMES;

  /**
   * Bumped when a day is opened or closed.
   *
   * Form values are not signals, so a template reading one would not be marked
   * dirty when the checkbox changes. A page-local counter is what makes the
   * dependent bindings — the disabled inputs, the draft total — update.
   */
  private readonly enabledChanged = signal(0);

  protected readonly days = new FormArray<DayForm>(this.buildDays());

  protected readonly form = this.fb.group({ days: this.days });

  /** The published week, shown beside the form so a save can be seen to stick. */
  protected readonly published = computed(() => {
    const days = this.session.schedule().filter((day) => day.enabled);
    return `${days.length} ${days.length === 1 ? 'day' : 'days'} · ${formatDuration(
      this.session.weeklyMinutes(),
    )} a week`;
  });

  constructor() {
    this.fillFromStore();
    this.watchDayToggles();
  }

  /**
   * A closed day's hours are disabled, not just dimmed.
   *
   * Driven through the controls rather than a `[disabled]` attribute on the
   * input: Angular warns that a `disabled` attribute bound to a reactive form is
   * read once at creation, so toggling a day would leave the inputs looking
   * closed while still editable and still validating.
   */
  private watchDayToggles(): void {
    for (const group of this.days.controls) {
      const hours = [group.get('startTime')!, group.get('endTime')!];

      // `valueChanges` does not replay the current value, so the state the store
      // was filled with has to be applied once here.
      this.applyEnabled(group, group.get('enabled')!.value);

      group.get('enabled')!.valueChanges.subscribe((on) => {
        this.applyEnabled(group, on);
        this.enabledChanged.update((n) => n + 1);
      });
    }
  }

  private applyEnabled(group: DayForm, on: boolean): void {
    for (const control of [group.get('startTime')!, group.get('endTime')!]) {
      if (on) control.enable({ emitEvent: false });
      else control.disable({ emitEvent: false });
    }
    // A disabled control drops out of the group's value, so revalidate to keep
    // the day from being reported invalid on the strength of a field the doctor
    // cannot even see.
    group.updateValueAndValidity({ emitEvent: false });
  }

  protected row(index: number): DayForm {
    return this.days.at(index);
  }

  /**
   * Whether a day is currently open.
   *
   * Reads the counter first so the template is marked dirty when a day is
   * toggled, then the control for the value.
   */
  protected isOpen(index: number): boolean {
    this.enabledChanged();
    return this.row(index).getRawValue().enabled;
  }

  protected controlId(index: number, part: 'start' | 'end'): string {
    return `schedule-${index}-${part}`;
  }

  /**
   * What the form currently adds up to.
   *
   * A method rather than a `computed`: a form's value is not a signal, so a
   * `computed` would read it once and cache the total forever. Re-evaluating on
   * each change detection is cheap and always current. An invalid day counts as
   * zero, so a half-finished row cannot make the total look plausible.
   */
  protected draftSummary(): string {
    this.enabledChanged();
    let total = 0;
    let open = 0;
    for (const group of this.days.controls) {
      if (!group.get('enabled')!.value) continue;
      open += 1;
      if (group.invalid) continue;
      const start = minutesOfDay(group.get('startTime')!.value);
      const end = minutesOfDay(group.get('endTime')!.value);
      if (start === null || end === null) continue;
      total += Math.max(0, end - start);
    }
    return `${open} ${open === 1 ? 'day' : 'days'} · ${formatDuration(total)} a week`;
  }

  protected showTimeError(index: number): boolean {
    return this.row(index).touched && !!this.row(index).errors?.['endBeforeStart'];
  }

  protected timeError(): string {
    return 'End time must be later than the start time.';
  }

  protected reset(): void {
    this.fillFromStore();
    this.notice.set(null);
  }

  protected save(): void {
    if (this.form.invalid) {
      // Touch every row so the messages appear, rather than silently refusing.
      this.days.markAllAsTouched();
      this.notice.set('Fix the highlighted days before saving.');
      return;
    }

    // Read the controls individually rather than with `getRawValue`, which omits
    // disabled controls — that would save a closed day as having no hours at all
    // and lose the times the doctor set before closing it.
    this.session.saveSchedule(
      this.days.controls.map((group, index) => ({
        dayOfWeek: index,
        enabled: group.get('enabled')!.value,
        startTime: group.get('startTime')!.value,
        endTime: group.get('endTime')!.value,
      })),
    );
    this.notice.set(`Saved. You now publish ${this.draftSummary()}.`);
  }

  private buildDays(): DayForm[] {
    return DAY_NAMES.map(() =>
      this.fb.group(
        {
          enabled: this.fb.control(true),
          startTime: this.fb.control('09:00', Validators.required),
          endTime: this.fb.control('17:00', Validators.required),
        },
        { validators: startBeforeEnd },
      ),
    );
  }

  private fillFromStore(): void {
    this.session.schedule().forEach((day, index) => {
      const group = this.days.at(index);
      group.setValue({ enabled: day.enabled, startTime: day.startTime, endTime: day.endTime });
      group.markAsPristine();
      group.markAsUntouched();
    });
  }
}
