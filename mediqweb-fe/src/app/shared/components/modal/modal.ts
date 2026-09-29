import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

/**
 * Modal dialog built on the native `<dialog>` element.
 *
 * Using `showModal()` gets a real focus trap, inert background content,
 * top-layer stacking and Escape-to-dismiss from the platform — none of which
 * are reimplemented here, and no extra dependency is required. This matters
 * for a clinical app where correct keyboard behaviour is a requirement, not a
 * nicety.
 *
 * The `open` input stays authoritative: the component never flips it itself,
 * it only requests dismissal through `closed`.
 */
@Component({
  selector: 'ui-modal',
  templateUrl: './modal.html',
  styleUrl: './modal.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Modal {
  readonly open = input(false);
  readonly title = input<string | null>(null);
  readonly size = input<ModalSize>('md');
  /** Clicking the backdrop dismisses the dialog. */
  readonly closeOnBackdrop = input(true);
  /** Escape dismisses the dialog. */
  readonly closeOnEscape = input(true);
  /** Hides the header close button for dialogs that require an explicit choice. */
  readonly showClose = input(true);
  readonly closed = output<void>();

  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // Signal queries are reactive, so this re-runs once the view exists.
    effect(() => {
      const dialog = this.dialogRef()?.nativeElement;
      if (!dialog) return;
      if (this.open() && !dialog.open) {
        this.openDialog(dialog);
      } else if (!this.open() && dialog.open) {
        this.closeDialog(dialog);
      }
    });
  }

  /**
   * `showModal()` is absent in some non-browser DOM implementations (jsdom,
   * older engines), so fall back to the reflected attribute rather than
   * throwing and taking the whole view down with it.
   */
  private openDialog(dialog: HTMLDialogElement): void {
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  private closeDialog(dialog: HTMLDialogElement): void {
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
  }

  /** Public dismissal API for the header button and Escape handling. */
  close(): void {
    this.closed.emit();
  }

  protected onBackdropClick(event: MouseEvent): void {
    // Clicks on the panel bubble here too; only the <dialog> itself is backdrop.
    if (event.target !== this.dialogRef()?.nativeElement) return;
    if (this.closeOnBackdrop()) this.close();
  }

  protected onCancel(event: Event): void {
    if (!this.closeOnEscape()) {
      event.preventDefault();
      return;
    }
    // Let the native close run, then notify the owner.
    this.closed.emit();
  }
}
