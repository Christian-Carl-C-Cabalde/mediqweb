import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Avatar, Button, Card, MockNotice, StatusBadge } from '../../../shared/components';
import { dayLabel, relativeStamp } from '../../secretary.dates';
import { SecretarySession } from '../../secretary-session';
import type { Conversation, ConversationMessage } from '../../secretary.models';

/** A day separator in the thread, so a conversation spanning days stays readable. */
interface DayDivider {
  readonly kind: 'day';
  readonly key: string;
  readonly label: string;
}

/** One message bubble. */
interface MessageRow {
  readonly kind: 'message';
  readonly key: string;
  readonly message: ConversationMessage;
}

type ThreadRow = DayDivider | MessageRow;

/**
 * The Secretary's message desk.
 *
 * Two panes over one store: a list of threads on the left, the open thread on the
 * right. Deliberately one screen rather than a list screen plus a detail route —
 * the work here is comparing a thread against the others ("has anybody else
 * asked about Saturday?"), which a route change would hide.
 *
 * Scoped to the assigned doctor, like every other screen here: a thread with one
 * of this doctor's patients, or with the doctor themselves. The bodies name people
 * and quote their appointments, so a thread that survived a name-based filter
 * while carrying another patient's details would be the worst kind of leak — the
 * filter is on the party, in the store.
 *
 * Sending a reply appends to the in-memory session, exactly as booking appends to
 * the appointments, so the round trip is demonstrable end to end with no backend.
 * That is the whole feature: there is no transport, no delivery state and no
 * other party actually replying.
 */
@Component({
  selector: 'app-secretary-messages',
  imports: [DatePipe, Avatar, Button, Card, MockNotice, StatusBadge],
  templateUrl: './secretary-messages.html',
  styleUrl: './secretary-messages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretaryMessages {
  private readonly session = inject(SecretarySession);

  /**
   * The open thread, defaulting to the most recently active one.
   *
   * Read once at construction rather than tracked, so sending a reply — which
   * re-sorts the list — cannot quietly move the reader to a different thread
   * while they are part-way through typing into it.
   *
   * The default is deliberately *not* treated as opening the thread: it does not
   * mark anything read. Loading a page is not the same as working through a
   * queue, and a badge that empties itself on arrival tells the user nothing.
   */
  protected readonly selectedId = signal<string | null>(
    this.session.conversations()[0]?.conversation.id ?? null,
  );

  /** What is in the composer. A signal rather than a form control so `canSend` can be derived. */
  protected readonly draft = signal('');

  protected readonly conversations = this.session.conversations;
  protected readonly selected = computed(() => {
    const id = this.selectedId();
    return id ? this.session.conversationById(id) : null;
  });

  protected readonly canSend = computed(() => this.draft().trim().length > 0);

  /**
   * The open thread flattened for `@for`, with a divider inserted whenever the
   * calendar day changes.
   *
   * Interleaving the dividers here rather than tracking "last day" inside the
   * template keeps the comparison next to the iteration it belongs to, and means
   * the template never has to know why a divider appeared.
   */
  protected readonly threadRows = computed<ThreadRow[]>(() => {
    const summary = this.selected();
    if (!summary) return [];

    const now = this.session.now();
    const rows: ThreadRow[] = [];
    let day = '';

    for (const message of summary.messages) {
      const key = message.sentAt.slice(0, 10);
      if (key !== day) {
        day = key;
        rows.push({ kind: 'day', key: `day-${key}`, label: dayLabel(message.sentAt, now) });
      }
      rows.push({ kind: 'message', key: message.id, message });
    }

    return rows;
  });

  /** Where new messages appear without the reader having to scroll for them. */
  private readonly thread = viewChild<ElementRef<HTMLElement>>('thread');

  constructor() {
    effect(() => {
      // Reads `threadRows` so the effect re-runs whenever the open thread changes
      // or a message lands, and not for unrelated renders.
      const rows = this.threadRows();
      const element = this.thread()?.nativeElement;
      if (!element || rows.length === 0) return;
      element.scrollTop = element.scrollHeight;
    });
  }

  /**
   * Opens a thread and clears anything unread in it.
   *
   * The draft is cleared as well: carrying a half-written reply from one patient
   * to another is how the wrong message gets sent to a real person.
   */
  protected onSelect(conversationId: string): void {
    this.selectedId.set(conversationId);
    this.draft.set('');
    this.session.markConversationRead(conversationId);
  }

  protected onDraft(event: Event): void {
    this.draft.set((event.target as HTMLTextAreaElement).value);
  }

  /**
   * Enter sends, Shift + Enter starts a new line.
   *
   * Handled on the textarea rather than with a global key listener so it only
   * applies while the composer has focus — a stray Enter elsewhere on the page
   * must not send a patient's reply.
   */
  protected onComposerKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Enter' || event.shiftKey) return;
    event.preventDefault();
    this.send();
  }

  /**
   * Appends the draft to the open thread.
   *
   * The draft is only cleared when the store accepted it, so a refused send does
   * not throw away what somebody typed.
   */
  protected send(): void {
    const summary = this.selected();
    if (!summary) return;
    if (this.session.sendMessage(summary.conversation.id, this.draft())) {
      this.draft.set('');
    }
  }

  /** Relative stamp for a list row: "12 min ago", "Yesterday", "4 Mar". */
  protected stamp(iso: string): string {
    return relativeStamp(iso, this.session.now());
  }

  /** The line under a name: "Patient · 2 visits", "Doctor · Cardiology". */
  protected subtitle(conversation: Conversation): string {
    return this.session.conversationSubtitle(conversation);
  }
}
