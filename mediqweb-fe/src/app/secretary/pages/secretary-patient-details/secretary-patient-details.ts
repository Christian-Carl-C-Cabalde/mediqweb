import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import {
  AppointmentStatusBadge,
  Avatar,
  Card,
  DetailList,
  MockNotice,
  StatusBadge,
  Table,
  TableCell,
  type BadgeTone,
  type TableColumn,
} from '../../../shared/components';
import type { AccountStatus } from '../../../shared/domain/account-status';
import { ageFrom, formatDuration } from '../../secretary.dates';
import { SecretarySession } from '../../secretary-session';
import type { Appointment } from '../../secretary.models';

/**
 * A patient's file as the desk sees them: who they are, how to reach them, and
 * every appointment they have had with any of the clinic's doctors.
 *
 * The route parameter is read as a signal rather than from a snapshot, so the
 * page updates when the router reuses this component for a different id instead
 * of showing the previous patient.
 *
 * A patient record — diagnoses, notes, prescriptions — is deliberately not here.
 * That is a separate milestone with its own access rules, and showing an empty
 * "Medical history" panel would imply a feature that does not exist. A secretary
 * needs the administrative history to answer the phone, which is what this shows.
 */
@Component({
  selector: 'app-secretary-patient-details',
  imports: [
    DatePipe,
    RouterLink,
    AppointmentStatusBadge,
    Avatar,
    Card,
    DetailList,
    MockNotice,
    StatusBadge,
    Table,
    TableCell,
  ],
  templateUrl: './secretary-patient-details.html',
  styleUrl: './secretary-patient-details.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretaryPatientDetails {
  private readonly session = inject(SecretarySession);
  private readonly route = inject(ActivatedRoute);

  private readonly patientId = toSignal(
    this.route.paramMap.pipe(map((params) => params.get('id'))),
    {
      initialValue: this.route.snapshot.paramMap.get('id'),
    },
  );

  /** `null` for an id that matches nobody, which the template renders as a 404. */
  protected readonly patient = computed(() => {
    const id = this.patientId();
    return id ? this.session.patientById(id) : null;
  });

  protected readonly history = computed<Appointment[]>(() => {
    const patient = this.patient();
    return patient ? this.session.appointmentsForPatient(patient.id) : [];
  });

  /** Newest first: a history is read backwards, and so is this table. */
  protected readonly historyRows = computed(() => [...this.history()].reverse());

  protected readonly columns: TableColumn<Appointment>[] = [
    { key: 'startsAt', header: 'When', sortable: true },
    { key: 'doctorId', header: 'Doctor' },
    { key: 'reason', header: 'Reason' },
    { key: 'durationMinutes', header: 'Length', hideBelow: 'md' },
    { key: 'status', header: 'Status', sortable: true },
  ];

  protected readonly now = this.session.now;

  protected age(): number {
    const patient = this.patient();
    return patient ? ageFrom(patient.dateOfBirth, this.now()) : 0;
  }

  protected doctorName(appointment: Appointment): string {
    return this.session.doctorName(appointment.doctorId);
  }

  protected length(appointment: Appointment): string {
    return formatDuration(appointment.durationMinutes);
  }

  protected statusTone(status: AccountStatus): BadgeTone {
    return status === 'active' ? 'success' : 'neutral';
  }
}
