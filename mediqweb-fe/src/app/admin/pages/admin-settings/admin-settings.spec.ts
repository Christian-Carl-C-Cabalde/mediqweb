import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { clearToasts, latestToast } from '../../../core/services/toast.service.spec-helpers';
import { AdminSettings } from './admin-settings';

describe('AdminSettings', () => {
  let fixture: ComponentFixture<AdminSettings>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [AdminSettings] });
    fixture = TestBed.createComponent(AdminSettings);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  // Disarms the dismissal timers the toasts arm.
  afterEach(() => clearToasts());

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  function page(): any {
    return fixture.componentInstance;
  }

  it('starts with sample values so the form is reviewable', () => {
    expect(page().form.getRawValue().clinicName).toBe('MediQ Clinic');
  });

  it('requires the clinic details', () => {
    page().form.controls.clinicName.setValue('');
    page().save();
    fixture.detectChanges();
    expect(page().errorFor('clinicName')).toBe('This field is required.');
  });

  it('rejects a malformed contact email', () => {
    page().form.controls.contactEmail.setValue('nope');
    page().save();
    fixture.detectChanges();
    expect(page().errorFor('contactEmail')).toBe('Enter a valid email address.');
  });

  it('says nothing was saved rather than pretending it worked', () => {
    page().save();
    fixture.detectChanges();
    // An error, and never a success: there is no service to call, so nothing can
    // have been saved. Telling an administrator their clinic settings are stored
    // when they are not is the worst thing this screen could do.
    expect(latestToast()?.tone).toBe('error');
    expect(latestToast()?.title).toContain('Nothing was saved');
    expect(latestToast()?.message).toContain('not connected');
  });

  it('reports an incomplete form as a warning, not a failure', () => {
    page().form.controls.contactEmail.setValue('not-an-email');
    page().save();
    fixture.detectChanges();

    // Nothing was attempted and the store was never reached.
    expect(latestToast()?.tone).toBe('warning');
    expect(latestToast()?.title).toContain('Nothing saved');
    // The field-level message is still what names the offending field.
    expect(text()).toContain('Enter a valid email address.');
  });

  it('applies a dropdown choice to its form control', () => {
    page().pick('slotLength', { id: '45', label: '45 minutes' });
    expect(page().selectedOf('slotLength')).toBe('45');
  });

  it('offers no boolean toggles, which the design system has no control for', () => {
    const box = fixture.nativeElement.querySelector('input[type="checkbox"]');
    expect(box).toBeNull();
  });
});
