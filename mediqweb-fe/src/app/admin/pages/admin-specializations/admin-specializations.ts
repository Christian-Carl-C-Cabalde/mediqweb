import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Button, Card, FilterBar, FormField, Modal, MockNotice } from '../../../shared/components';
import { AdminSession } from '../../admin-session';
import type { Specialization } from '../../admin.models';

/**
 * The specialties a doctor can be assigned to.
 *
 * Presented as a card grid rather than a table: there are few of them, each has
 * a sentence of description, and the doctor count is the thing worth scanning
 * for.
 *
 * Only adding and renaming are offered. Removing a specialty is deliberately
 * absent — a doctor may already be assigned to it, and deciding what happens to
 * those doctors needs the API's referential rules rather than a mock's guess.
 */
@Component({
  selector: 'app-admin-specializations',
  imports: [ReactiveFormsModule, Button, Card, FormField, Modal, FilterBar, MockNotice],
  templateUrl: './admin-specializations.html',
  styleUrl: './admin-specializations.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSpecializations {
  private readonly fb = inject(FormBuilder);
  private readonly session = inject(AdminSession);

  protected readonly query = signal('');
  protected readonly editorOpen = signal(false);
  protected readonly editing = signal<Specialization | null>(null);
  protected readonly notice = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(60)]],
    description: ['', [Validators.required, Validators.maxLength(160)]],
  });

  /** How many doctors are assigned to each specialty. */
  private readonly doctorCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const doctor of this.session.doctors()) {
      if (!doctor.specializationId) continue;
      counts.set(doctor.specializationId, (counts.get(doctor.specializationId) ?? 0) + 1);
    }
    return counts;
  });

  protected readonly specializations = computed(() => {
    const term = this.query().trim().toLowerCase();
    return this.session
      .specializations()
      .filter((s) => !term || s.name.toLowerCase().includes(term))
      .map((s) => ({ ...s, doctorCount: this.doctorCounts().get(s.id) ?? 0 }));
  });

  protected openCreate(): void {
    this.editing.set(null);
    this.form.reset();
    this.editorOpen.set(true);
  }

  protected openEdit(specialization: Specialization): void {
    this.editing.set(specialization);
    this.form.reset({ name: specialization.name, description: specialization.description });
    this.editorOpen.set(true);
  }

  protected closeEditor(): void {
    this.editorOpen.set(false);
  }

  protected readonly isEditing = computed(() => this.editing() !== null);

  protected nameError(): string | null {
    const field = this.form.controls.name;
    if (!field.touched) return null;
    if (field.hasError('required')) return 'Enter a name.';
    if (field.hasError('maxlength')) return 'Keep the name under 60 characters.';
    return null;
  }

  protected descriptionError(): string | null {
    const field = this.form.controls.description;
    if (!field.touched) return null;
    if (field.hasError('required')) return 'Enter a short description.';
    if (field.hasError('maxlength')) return 'Keep the description under 160 characters.';
    return null;
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { name, description } = this.form.getRawValue();
    const current = this.editing();

    if (current) {
      this.session.updateSpecialization(current.id, name, description);
      this.notice.set(`Updated ${name.trim()}.`);
    } else {
      this.session.addSpecialization(name, description);
      this.notice.set(`Added ${name.trim()}.`);
    }

    this.editorOpen.set(false);
  }
}
