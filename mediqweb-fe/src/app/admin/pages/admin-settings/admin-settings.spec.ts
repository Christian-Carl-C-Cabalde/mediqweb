import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminSettings } from './admin-settings';

describe('AdminSettings', () => {
  let fixture: ComponentFixture<AdminSettings>;

  beforeEach(async () => {
    TestBed.configureTestingModule({ imports: [AdminSettings] });
    fixture = TestBed.createComponent(AdminSettings);
    fixture.detectChanges();
    await fixture.whenStable();
  });

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
    expect(page().notice()).toContain('nothing was saved');
  });

  it('applies a dropdown choice to its form control', () => {
    page().pick('slotLength', { id: '45', label: '45 minutes' });
    expect(page().selectedOf('slotLength')).toBe('45');
  });

  it('clears a previous notice when a setting changes', () => {
    page().save();
    expect(page().notice()).toBeTruthy();
    page().pick('retentionPeriod', { id: '365', label: '1 year' });
    expect(page().notice()).toBeNull();
  });

  it('offers no boolean toggles, which the design system has no control for', () => {
    const box = fixture.nativeElement.querySelector('input[type="checkbox"]');
    expect(box).toBeNull();
  });
});
