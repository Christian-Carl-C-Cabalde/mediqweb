/**
 * Date helpers for the Doctor area.
 *
 * Timestamps are zone-less local strings (see `Appointment.startsAt`), so every
 * comparison here is a string comparison on `YYYY-MM-DD` or a `Date` built from
 * a local string. No `toISOString()` anywhere: it converts to UTC and would move
 * an appointment to the wrong day for anyone east or west of Greenwich.
 */

const pad = (value: number): string => String(value).padStart(2, '0');

/** `YYYY-MM-DD` for a `Date`, in local time. */
export function dayKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `YYYY-MM-DDTHH:MM:SS` for a `Date`, in local time. */
export function localIso(date: Date): string {
  return `${dayKey(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

/** Midnight on the day `date` falls in. */
export function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** True when both timestamps fall on the same local calendar day. */
export function isSameDay(a: Date, b: Date): boolean {
  return dayKey(a) === dayKey(b);
}

/**
 * Whole years between a birth date and `now`, floored.
 *
 * Compares month and day before adjusting the year, so someone who has not had
 * their birthday yet this year is not counted as a year older.
 */
export function ageFrom(dateOfBirth: string, now: Date): number {
  const born = new Date(`${dateOfBirth}T00:00:00`);
  if (Number.isNaN(born.getTime())) return 0;
  let age = now.getFullYear() - born.getFullYear();
  const monthDiff = now.getMonth() - born.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < born.getDate())) age -= 1;
  return Math.max(0, age);
}

/** Minutes since midnight for an `HH:MM` string, or `null` if it is not one. */
export function minutesOfDay(time: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(time);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** `150` -> `2h 30m`. Used for durations and for weekly availability totals. */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest}m`;
  if (!rest) return `${hours}h`;
  return `${hours}h ${rest}m`;
}
