/**
 * Where an appointment is in its lifecycle.
 *
 * Shared because both staff areas that show appointments have to agree on it:
 * the Secretary books, moves and calls off; the Doctor confirms, completes and
 * records a no-show. `shared-appointment-status` maps these to badge tones, so a
 * type per area would mean a `no-show` rendering in a different colour depending
 * on which side of the desk you were sitting on.
 *
 * Each area re-exports this from its own models file, so pages keep importing
 * `AppointmentStatus` from where they always have.
 */
export type AppointmentStatus = 'booked' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';

/** Statuses that mean the patient is expected to turn up. */
export const LIVE_STATUSES: readonly AppointmentStatus[] = ['booked', 'confirmed'];

/** Statuses that end an appointment's life, so it can no longer be acted on. */
export const CLOSED_STATUSES: readonly AppointmentStatus[] = ['completed', 'cancelled', 'no-show'];
