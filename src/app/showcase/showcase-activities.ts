import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { formatDateShort, getTodayIsoLocal } from '../../core/domain/services/calendar-duration';
import { MessageLanguage } from '../../core/domain/services/message-generator';
import { WorkspaceStore } from '../../core/main/workspace-store';
import { I18nService } from '../services/i18n';

/**
 * Minimalist full-screen presentation view of activities with 4 separate numeric A / M / S / G columns,
 * click-to-copy dual messages, and an unobtrusive buttonless inline ghost row at the bottom to add a new activity.
 */
@Component({
  selector: 'app-showcase-activities',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    <section class="w-full" aria-label="Elenco attività in visualizzazione">
      <div class="w-full overflow-x-auto sheet-scroll">
        <table
          class="w-full border-collapse text-left font-sans text-[15px] text-[#202124]"
          data-testid="showcase-activities-table"
        >
          <thead>
            <tr class="border-b border-[#E8EAED] text-[13px] font-medium text-[#5F6368]">
              <th scope="col" class="py-3 pr-5 min-w-[220px] font-medium">{{ i18n.t('showcase.colActivity') }}</th>
              <th scope="col" class="py-3 px-3 w-[112px] font-medium whitespace-nowrap">{{ i18n.t('showcase.colStart') }}</th>
              <th scope="col" class="py-3 px-3 w-[112px] font-medium whitespace-nowrap">{{ i18n.t('showcase.colEnd') }}</th>
              <th scope="col" class="py-3 px-3 w-[74px] text-right font-medium whitespace-nowrap">{{ i18n.t('showcase.colDays') }}</th>
              <th scope="col" class="py-3 px-2 w-[42px] text-right font-medium" [title]="i18n.t('showcase.colYTitle')">{{ i18n.t('showcase.colY') }}</th>
              <th scope="col" class="py-3 px-2 w-[42px] text-right font-medium" [title]="i18n.t('showcase.colMTitle')">{{ i18n.t('showcase.colM') }}</th>
              <th scope="col" class="py-3 px-2 w-[42px] text-right font-medium" [title]="i18n.t('showcase.colWTitle')">{{ i18n.t('showcase.colW') }}</th>
              <th scope="col" class="py-3 px-2 w-[42px] text-right font-medium" [title]="i18n.t('showcase.colDTitle')">{{ i18n.t('showcase.colD') }}</th>
              <th scope="col" class="py-3 pl-6 min-w-[330px] font-medium">
                <div class="flex items-center justify-between gap-3">
                  <span>
                    {{ i18n.t('showcase.colMessages') }}
                    <span class="font-normal text-[#80868B]">{{ i18n.t('showcase.colMessagesHint') }}</span>
                  </span>
                  <div
                    role="group"
                    [attr.aria-label]="i18n.t('messages.langAria')"
                    data-testid="showcase-msg-lang-switcher"
                    class="inline-flex items-center rounded-md border border-[#E8EAED] bg-[#F8F9FA] p-0.5 shrink-0"
                  >
                    @for (lang of messageLanguages; track lang) {
                      <button
                        type="button"
                        (click)="store.setMessageLanguage(lang)"
                        [attr.aria-pressed]="store.messageLanguage() === lang"
                        [attr.data-testid]="'msg-lang-' + lang"
                        [class]="
                          store.messageLanguage() === lang
                            ? 'px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase bg-white text-[#1A73E8] shadow-xs cursor-pointer'
                            : 'px-1.5 py-0.5 rounded text-[11px] font-medium uppercase text-[#5F6368] hover:text-[#202124] cursor-pointer'
                        "
                      >
                        {{ lang }}
                      </button>
                    }
                  </div>
                </div>
              </th>
              <th scope="col" class="py-3 pl-3 w-11 text-right font-medium">
                <span class="sr-only">{{ i18n.t('showcase.colShare') }}</span>
              </th>
            </tr>
          </thead>

          <tbody class="divide-y divide-[#F1F3F4]">
            @for (item of store.enrichedGoals(); track item.goal.id) {
              <tr class="hover:bg-[#FAFAFA] transition-colors">
                <!-- Bold Google 4-Color Activity Title -->
                <td class="py-4 pr-5 align-middle">
                  <span [class]="'block text-[16px] font-bold leading-snug break-words ' + item.palette.inkClass">
                    {{ item.goal.title }}
                  </span>
                </td>

                <!-- Start Date -->
                <td class="py-4 px-3 align-middle text-[15px] text-[#3C4043] tabular-nums whitespace-nowrap">
                  {{ formatDate(item.goal.startDate) }}
                </td>

                <!-- End Date -->
                <td class="py-4 px-3 align-middle text-[15px] text-[#5F6368] tabular-nums whitespace-nowrap">
                  {{ item.goal.endDate ? formatDate(item.goal.endDate) : '—' }}
                </td>

                <!-- Primary Days Counter -->
                <td class="py-4 px-3 text-right align-middle text-[16px] font-semibold text-[#202124] tabular-nums whitespace-nowrap">
                  {{ item.metrics.primaryDays !== null ? item.metrics.primaryDays : '—' }}
                </td>

                <!-- 4 Separate Pure Numeric A / M / S / G Columns (zero y/m/w/d letters) -->
                <td class="py-4 px-2 text-right align-middle text-[15px] text-[#3C4043] tabular-nums">
                  {{ item.metrics.breakdown !== null ? item.metrics.breakdown.years : '—' }}
                </td>
                <td class="py-4 px-2 text-right align-middle text-[15px] text-[#3C4043] tabular-nums">
                  {{ item.metrics.breakdown !== null ? item.metrics.breakdown.months : '—' }}
                </td>
                <td class="py-4 px-2 text-right align-middle text-[15px] text-[#3C4043] tabular-nums">
                  {{ item.metrics.breakdown !== null ? item.metrics.breakdown.weeks : '—' }}
                </td>
                <td class="py-4 px-2 text-right align-middle text-[15px] text-[#3C4043] tabular-nums">
                  {{ item.metrics.breakdown !== null ? item.metrics.breakdown.days : '—' }}
                </td>

                <!-- Dual Copyable Share Messages (click directly on either line to copy) -->
                <td class="py-3.5 pl-6 align-middle">
                  <div class="flex flex-col gap-1">
                    <button
                      type="button"
                      (click)="copyMessage(item.goal.id + ':days', item.metrics.shareDaysMessage)"
                      [attr.aria-label]="'Copia: ' + item.metrics.shareDaysMessage"
                      class="group/msg w-full text-left flex items-center justify-between gap-3 px-2.5 py-1 -mx-2.5 rounded-lg hover:bg-[#F1F3F4]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A73E8] transition-colors cursor-pointer"
                    >
                      <span class="text-[15px] text-[#202124] leading-snug break-words">
                        {{ item.metrics.shareDaysMessage }}
                      </span>
                      <span
                        [class]="
                          copiedKey() === item.goal.id + ':days'
                            ? 'inline-flex items-center gap-1 text-xs font-medium text-[#188038] shrink-0'
                            : 'inline-flex items-center gap-1 text-xs text-[#80868B] opacity-0 group-hover/msg:opacity-100 group-focus-visible/msg:opacity-100 transition-opacity shrink-0'
                        "
                      >
                        <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">
                          {{ copiedKey() === item.goal.id + ':days' ? 'check' : 'content_copy' }}
                        </mat-icon>
                        @if (copiedKey() === item.goal.id + ':days') {
                          <span>{{ i18n.t('common.copied') }}</span>
                        }
                      </span>
                    </button>

                    <button
                      type="button"
                      (click)="copyMessage(item.goal.id + ':ymw', item.metrics.shareYmwMessage)"
                      [attr.aria-label]="'Copia: ' + item.metrics.shareYmwMessage"
                      class="group/msg w-full text-left flex items-center justify-between gap-3 px-2.5 py-1 -mx-2.5 rounded-lg hover:bg-[#F1F3F4]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A73E8] transition-colors cursor-pointer"
                    >
                      <span class="text-[15px] text-[#5F6368] leading-snug break-words">
                        {{ item.metrics.shareYmwMessage }}
                      </span>
                      <span
                        [class]="
                          copiedKey() === item.goal.id + ':ymw'
                            ? 'inline-flex items-center gap-1 text-xs font-medium text-[#188038] shrink-0'
                            : 'inline-flex items-center gap-1 text-xs text-[#80868B] opacity-0 group-hover/msg:opacity-100 group-focus-visible/msg:opacity-100 transition-opacity shrink-0'
                        "
                      >
                        <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">
                          {{ copiedKey() === item.goal.id + ':ymw' ? 'check' : 'content_copy' }}
                        </mat-icon>
                        @if (copiedKey() === item.goal.id + ':ymw') {
                          <span>{{ i18n.t('common.copied') }}</span>
                        }
                      </span>
                    </button>
                  </div>
                </td>

                <!-- Social Card Share Trigger (Instagram Post / Stories) -->
                <td class="py-3.5 pl-3 text-right align-middle">
                  <button
                    type="button"
                    (click)="store.openSocialShare(item)"
                    [title]="i18n.t('data.shareCardAria', { title: item.goal.title })"
                    [attr.aria-label]="i18n.t('data.shareCardAria', { title: item.goal.title })"
                    data-testid="showcase-social-share-btn"
                    class="inline-flex items-center justify-center p-2 rounded-lg text-[#5F6368] hover:text-[#1A73E8] hover:bg-[#E8F0FE]/70 transition-colors cursor-pointer"
                  >
                    <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">share</mat-icon>
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <!-- Spacer so the last activity row always scrolls cleanly above the anchored bottom bar -->
      <div class="h-16" aria-hidden="true"></div>

      <!-- Anchored Bottom Minimalist Ghost Row (always visible at bottom edge, zero frills, crisp top hairline) -->
      <div
        [formGroup]="quickAddForm"
        (focusin)="composerActive.set(true)"
        (focusout)="onRowFocusOut($event)"
        data-testid="showcase-ghost-row"
        class="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-[#E8EAED] transition-colors"
        [class.bg-[#FAFAFA]]="composerActive() || hasDraftTitle()"
      >
        <div class="w-full px-6 sm:px-10 lg:px-14 py-3 flex flex-wrap sm:flex-nowrap items-center gap-x-6 gap-y-2">
          <div class="flex-1 min-w-[220px] max-w-[420px]">
            <div class="grid w-full">
              <div
                aria-hidden="true"
                class="col-start-1 row-start-1 invisible pointer-events-none select-none whitespace-pre-wrap break-words py-0.5 font-sans text-[16px] leading-snug min-h-[26px]"
              >{{ (titleMirror() || i18n.t('showcase.quickAddPlaceholder')) + '\u200b' }}</div>
              <textarea
                #ghostTitleInput
                rows="1"
                formControlName="title"
                (input)="titleMirror.set(quickAddForm.controls.title.value)"
                (keydown)="onGhostKeydown($event)"
                maxlength="160"
                [placeholder]="i18n.t('showcase.quickAddPlaceholder')"
                [attr.aria-label]="i18n.t('showcase.quickAddPlaceholder')"
                class="col-start-1 row-start-1 w-full h-full resize-none overflow-hidden whitespace-pre-wrap break-words py-0.5 bg-transparent border-0 focus:outline-none font-sans text-[16px] leading-snug text-[#202124] placeholder:text-[#9AA0A6] focus:placeholder:text-[#BDC1C6]"
                [class.font-bold]="hasDraftTitle()"
              ></textarea>
            </div>
          </div>

          @if (composerActive() || hasDraftTitle()) {
            <div class="flex items-center gap-5 shrink-0">
              <label class="flex items-center gap-2 text-[13px] text-[#5F6368]">
                <span class="whitespace-nowrap">{{ i18n.t('showcase.colStart') }}</span>
                <input
                  type="date"
                  formControlName="startDate"
                  (keydown)="onGhostKeydown($event)"
                  [attr.aria-label]="i18n.t('showcase.colStart')"
                  class="bg-transparent border-0 border-b border-transparent focus:border-[#1A73E8] focus:outline-none font-sans text-[14px] text-[#3C4043] tabular-nums cursor-pointer"
                />
              </label>

              <label class="flex items-center gap-2 text-[13px] text-[#5F6368]">
                <span class="whitespace-nowrap">{{ i18n.t('showcase.colEnd') }}</span>
                <input
                  type="date"
                  formControlName="endDate"
                  (keydown)="onGhostKeydown($event)"
                  [attr.aria-label]="i18n.t('showcase.colEnd')"
                  class="bg-transparent border-0 border-b border-transparent focus:border-[#1A73E8] focus:outline-none font-sans text-[14px] text-[#80868B] tabular-nums cursor-pointer"
                />
              </label>
            </div>

            <div class="sm:ml-auto shrink-0">
              @if (hasDraftTitle()) {
                <button
                  type="button"
                  (mousedown)="$event.preventDefault()"
                  (click)="commitQuickAdd()"
                  class="inline-flex items-center gap-1 text-[13px] text-[#1A73E8] hover:underline whitespace-nowrap cursor-pointer"
                >
                  <span>{{ i18n.t('showcase.quickAddEnter') }}</span>
                  <span aria-hidden="true">↵</span>
                </button>
              } @else {
                <span class="text-[13px] text-[#9AA0A6] whitespace-nowrap">
                  {{ i18n.t('showcase.quickAddHint') }}
                </span>
              }
            </div>
          }
        </div>
      </div>
    </section>
  `,
})
export class ShowcaseActivities {
  protected readonly store = inject(WorkspaceStore);
  protected readonly i18n = inject(I18nService);
  protected readonly messageLanguages: readonly MessageLanguage[] = ['en', 'it', 'es'];
  protected readonly openBackend = output<void>();
  protected readonly copiedKey = signal<string | null>(null);
  protected readonly composerActive = signal<boolean>(false);
  protected readonly titleMirror = signal<string>('');
  private readonly ghostTitleInput = viewChild<ElementRef<HTMLTextAreaElement>>('ghostTitleInput');
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly quickAddForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    startDate: new FormControl(getTodayIsoLocal(), { nonNullable: true }),
    endDate: new FormControl('', { nonNullable: true }),
  });

  protected hasDraftTitle(): boolean {
    return this.titleMirror().trim().length > 0;
  }

  protected formatDate(iso: string): string {
    return iso ? formatDateShort(iso) : '—';
  }

  protected onRowFocusOut(event: FocusEvent): void {
    const row = event.currentTarget as HTMLElement | null;
    const next = event.relatedTarget as Node | null;
    if (row && next && row.contains(next)) {
      return;
    }
    this.composerActive.set(false);
  }

  protected onGhostKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.resetQuickAdd();
      (event.target as HTMLElement).blur();
      return;
    }
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.commitQuickAdd();
    }
  }

  protected async commitQuickAdd(): Promise<void> {
    const raw = this.quickAddForm.getRawValue();
    const cleanTitle = raw.title.replace(/\s+/g, ' ').trim();
    if (!cleanTitle) return;

    const res = await this.store.addGoal({
      title: cleanTitle,
      startDate: raw.startDate,
      endDate: raw.endDate,
      notes: '',
    });

    if (res.ok) {
      this.resetQuickAdd();
      if (typeof window !== 'undefined') {
        requestAnimationFrame(() => {
          window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' });
        });
      }
      this.ghostTitleInput()?.nativeElement.focus();
    }
  }

  private resetQuickAdd(): void {
    this.quickAddForm.reset({
      title: '',
      startDate: getTodayIsoLocal(),
      endDate: '',
    });
    this.titleMirror.set('');
  }

  protected async copyMessage(key: string, text: string): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        this.fallbackCopy(text);
      }
    } else {
      this.fallbackCopy(text);
    }

    this.copiedKey.set(key);
    if (this.copyTimer) clearTimeout(this.copyTimer);
    this.copyTimer = setTimeout(() => {
      this.copiedKey.set(null);
    }, 1800);
  }

  private fallbackCopy(text: string): void {
    if (typeof document === 'undefined') return;
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      document.execCommand('copy');
    } finally {
      document.body.removeChild(area);
    }
  }
}
