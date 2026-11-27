import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  linkedSignal,
  output,
  viewChild,
} from '@angular/core';

/**
 * Google-Sheets-style auto-wrapping, auto-expanding inline editable cell.
 * Uses a CSS Grid shadow mirror so row height automatically wraps and expands
 * smoothly on render, on resize/zoom, and on every keystroke without JS flicker.
 */
@Component({
  selector: 'app-auto-grow-cell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid w-full items-stretch">
      <!-- Mirror element: shares exact padding, font, wrapping & grid cell to drive auto-height -->
      <div
        aria-hidden="true"
        [class]="
          'col-start-1 row-start-1 invisible pointer-events-none select-none whitespace-pre-wrap break-words px-2 py-1.5 border border-transparent font-sans text-[15px] leading-snug min-h-[34px] ' +
          textClass()
        "
      >{{ (draft() || placeholder() || ' ') + '\u200b' }}</div>

      <textarea
        #textareaEl
        rows="1"
        [value]="draft()"
        [attr.aria-label]="ariaLabel()"
        [attr.maxlength]="maxLength()"
        [attr.placeholder]="placeholder()"
        [attr.data-cell-row]="rowIndex()"
        [attr.data-cell-col]="colKey()"
        [attr.data-dirty]="isDirty() ? 'true' : 'false'"
        (input)="onInput($event)"
        (blur)="onBlur()"
        (keydown)="onKeydown($event)"
        [class]="
          'col-start-1 row-start-1 w-full h-full resize-none overflow-hidden whitespace-pre-wrap break-words px-2 py-1.5 rounded-md bg-transparent hover:bg-[#F1F3F4]/60 focus:bg-white border border-transparent focus:border-[#1A73E8] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/20 font-sans text-[15px] leading-snug transition-colors ' +
          textClass()
        "
      ></textarea>
    </div>
  `,
})
export class AutoGrowCell {
  readonly value = input.required<string>();
  readonly ariaLabel = input.required<string>();
  readonly textClass = input<string>('text-[#202124]');
  readonly placeholder = input<string>('');
  readonly maxLength = input<number>(160);
  readonly allowEmpty = input<boolean>(false);
  readonly allowNewlines = input<boolean>(false);
  readonly rowIndex = input<number>(-1);
  readonly colKey = input<string>('title');

  readonly committed = output<string>();
  readonly navigateVertical = output<-1 | 1>();

  private readonly textareaEl = viewChild<ElementRef<HTMLTextAreaElement>>('textareaEl');

  // Linked signal stays in sync whenever external `value()` updates (e.g. Undo/Redo or Firestore sync)
  protected readonly draft = linkedSignal(() => this.value());

  protected isDirty(): boolean {
    return this.draft() !== this.value();
  }

  focus(): void {
    const el = this.textareaEl()?.nativeElement;
    if (el) {
      el.focus();
      const len = el.value.length;
      el.setSelectionRange(len, len);
    }
  }

  protected onInput(event: Event): void {
    const el = event.target as HTMLTextAreaElement;
    this.draft.set(el.value);
  }

  protected onBlur(): void {
    this.commitCurrent();
  }

  protected onKeydown(event: KeyboardEvent): void {
    const el = event.target as HTMLTextAreaElement;

    // Escape reverts unsaved edits and leaves the cell (just like Sheets)
    if (event.key === 'Escape') {
      event.preventDefault();
      this.draft.set(this.value());
      el.value = this.value();
      el.blur();
      return;
    }

    // Enter commits and moves down (Shift+Enter moves up; Alt+Enter inserts newline if allowed)
    if (event.key === 'Enter') {
      if ((event.altKey || (event.shiftKey && this.allowNewlines())) && this.allowNewlines()) {
        // Insert newline explicitly for Alt+Enter (browsers don't insert newline on Alt+Enter by default)
        if (event.altKey) {
          event.preventDefault();
          const start = el.selectionStart ?? el.value.length;
          const end = el.selectionEnd ?? el.value.length;
          const next = el.value.slice(0, start) + '\n' + el.value.slice(end);
          el.value = next;
          this.draft.set(next);
          el.setSelectionRange(start + 1, start + 1);
        }
        return;
      }

      event.preventDefault();
      this.commitCurrent();
      this.navigateVertical.emit(event.shiftKey ? -1 : 1);
      return;
    }

    // ArrowUp / ArrowDown jump to adjacent row when caret is at very start/end of text
    if (event.key === 'ArrowDown' && !event.shiftKey && !event.altKey) {
      const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
      if (atEnd) {
        event.preventDefault();
        this.commitCurrent();
        this.navigateVertical.emit(1);
      }
      return;
    }

    if (event.key === 'ArrowUp' && !event.shiftKey && !event.altKey) {
      const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
      if (atStart) {
        event.preventDefault();
        this.commitCurrent();
        this.navigateVertical.emit(-1);
      }
    }
  }

  private commitCurrent(): void {
    const raw = this.draft();
    const cleaned = this.allowNewlines() ? raw.trim() : raw.replace(/\s+/g, ' ').trim();

    if (!cleaned && !this.allowEmpty()) {
      this.draft.set(this.value());
      const el = this.textareaEl()?.nativeElement;
      if (el) el.value = this.value();
      return;
    }

    if (cleaned !== this.value()) {
      this.draft.set(cleaned);
      this.committed.emit(cleaned);
    } else if (raw !== this.value()) {
      this.draft.set(this.value());
    }
  }
}
