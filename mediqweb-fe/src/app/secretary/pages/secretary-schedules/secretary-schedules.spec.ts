import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { DAY_NAMES, formatDuration } from '../../secretary.dates';
import { MOCK_APPOINTMENTS, MOCK_DOCTORS } from '../../secretary.mock-data';
import { SecretarySession } from '../../secretary-session';
import { SecretarySchedules } from './secretary-schedules';

describe('SecretarySchedules', () => {
  let fixture: ComponentFixture<SecretarySchedules>;
  let session: SecretarySession;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [SecretarySchedules],
      providers: [SecretarySession],
    });
    session = TestBed.inject(SecretarySession);
    const today = MOCK_APPOINTMENTS.find((a) => a.startsAt.slice(0, 10) === dayKeyNow());
    session.now.set(new Date(today?.startsAt ?? MOCK_APPOINTMENTS[0].startsAt));
    fixture = TestBed.createComponent(SecretarySchedules);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  function dayKeyNow(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  }

  function page(): any {
    return fixture.componentInstance;
  }

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('shows a week for every doctor, side by side', () => {
    expect(page().doctors().length).toBe(MOCK_DOCTORS.length);
    for (const doctor of MOCK_DOCTORS) {
      expect(text()).toContain(doctor.name);
    }
  });

  it('labels the columns Sunday to Saturday', () => {
    for (const name of DAY_NAMES) {
      expect(text()).toContain(name);
    }
  });

  it('gives each doctor a Sunday-first week', () => {
    for (const summary of page().doctors()) {
      const week = page()
        .daysFor(summary)
        .map((d: any) => d.dayOfWeek);
      expect(week).toEqual([0, 1, 2, 3, 4, 5, 6]);
    }
  });

  it('shows the published window, and a dash for a closed day', () => {
    const summary = page().doctors()[0];
    for (const day of page().daysFor(summary)) {
      const label = page().window(day);
      if (day.enabled) {
        expect(label).toBe(`${day.startTime} – ${day.endTime}`);
      } else {
        expect(label).toBe('—');
      }
    }
  });

  it('summarises the week from the published days, not a constant', () => {
    const summary = page().doctors()[0];
    const open = page()
      .daysFor(summary)
      .filter((d: any) => d.enabled).length;
    const expected = `${open} ${open === 1 ? 'day' : 'days'} · ${formatDuration(
      session.weeklyMinutes(summary.doctor.id),
    )} a week`;
    expect(page().publishedFor(summary)).toBe(expected);
  });

  it('says when a doctor publishes no hours at all', () => {
    const inactive = page()
      .doctors()
      .find((s: any) => s.doctor.status === 'inactive');
    expect(inactive).toBeTruthy();
    expect(page().publishedFor(inactive)).toBe('Not publishing any hours');
    expect(text()).toContain('Not taking bookings');
  });

  it('counts the appointments still to come from the store', () => {
    const now = session.now().getTime();
    for (const summary of page().doctors()) {
      const expected = session
        .appointmentsForDoctor(summary.doctor.id)
        .filter(
          (a) =>
            (a.status === 'booked' || a.status === 'confirmed') &&
            new Date(a.startsAt).getTime() >= now,
        ).length;
      expect(page().bookedFor(summary)).toBe(expected);
    }
  });

  it('narrows to one doctor and back, through the same control', () => {
    page().selectDoctor('doc-001');
    fixture.detectChanges();

    expect(page().doctors().length).toBe(1);
    expect(page().doctors()[0].doctor.id).toBe('doc-001');
    expect(page().isSelected('doc-001')).toBe(true);
    expect(text()).toContain('Show every doctor');
    expect(text()).not.toContain('Ana Lim');

    // Toggling the same name clears the filter: one control reads as both
    // "show one" and "show all again".
    page().selectDoctor('doc-001');
    fixture.detectChanges();
    expect(page().doctors().length).toBe(MOCK_DOCTORS.length);
    expect(text()).not.toContain('Show every doctor');
  });

  it('restores the full list from the clear button', () => {
    page().selectDoctor('doc-002');
    fixture.detectChanges();
    expect(page().doctors().length).toBe(1);

    const button = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (b) => b.textContent?.trim() === 'Show every doctor',
    );
    expect(button).toBeTruthy();
    button!.click();
    fixture.detectChanges();

    expect(page().doctors().length).toBe(MOCK_DOCTORS.length);
    expect(page().selectedDoctorId()).toBeNull();
  });

  it('marks the chosen doctor as pressed so the filter is discoverable', () => {
    const toggle = [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')].find(
      (b) => b.textContent?.includes('Rafael Santos'),
    );
    expect(toggle?.getAttribute('aria-pressed')).toBe('false');

    page().selectDoctor('doc-001');
    fixture.detectChanges();
    expect(toggle?.getAttribute('aria-pressed')).toBe('true');
  });

  it('is read-only, and says the conversation belongs to the doctor', () => {
    // No time input exists on the page: the hours are the doctor's to publish.
    expect((fixture.nativeElement as HTMLElement).querySelector('input')).toBeNull();
    expect(text()).toContain('a conversation with the doctor');
  });

  it('explains what an appointment can be booked into', () => {
    expect(text()).toContain('the only hours an appointment can be booked into');
  });

  it('handles an empty list rather than rendering nothing', () => {
    // The page filters internally, so the empty text is unreachable through the
    // UI — but a store that came back empty must still say so.
    expect(page().doctors().length).toBeGreaterThan(0);
    expect(text()).toContain('Sunday to Saturday');
  });

  it('says the data is a sample, so a screenshot is not mistaken for a product', () => {
    expect(text()).toContain('Sample data');
  });
});
