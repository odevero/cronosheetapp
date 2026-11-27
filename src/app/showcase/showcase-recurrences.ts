import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { EnrichedGoal, RecurrenceMatch } from '../../core/domain/entities/models';
import { formatDateShort } from '../../core/domain/services/calendar-duration';
import { getGoalReferenceDate } from '../../core/domain/services/message-generator';
import { WorkspaceStore } from '../../core/main/workspace-store';
import { I18nService } from '../services/i18n';

interface ShowcaseRecurrenceRow {
  readonly match: RecurrenceMatch;
  readonly referenceDateIso: string;
  readonly years: number | null;
  readonly months: number | null;
  readonly weeks: number | null;
  readonly days: number | null;
  readonly shareDaysMessage: string;
  readonly shareYmwMessage: string;
}

interface ShowcaseCompartment {
  readonly id: string;
  readonly title: string;
  readonly thresholdDays: number;
  readonly emptyText: string;
  readonly rows: readonly ShowcaseRecurrenceRow[];
}

/**
 * Pure read-only full-screen Recurrences board modeled on the user's Google Sheet:
 * - Bold black section headings (Anniversari, Mesiversari, Settimaniversari, Traguardi Giorni)
 * - Activity reference date (=IF($C4="", $D4, $C4)), separate pure-number A / M / S / G columns,
 *   countdown, and both click-to-copy shareable messages.
 */
@Component({
  selector: 'app-showcase-recurrences',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <section
      class="w-full space-y-12"
      aria-label="Tabellone ricorrenze in visualizzazione"
      data-testid="showcase-recurrences-board"
    >
      @for (section of compartments(); track section.id) {
        <div>
          <!-- Plain Bold Black Heading -->
          <div class="pb-2.5 flex items-baseline justify-between gap-4">
            <div class="flex items-baseline gap-3">
              <h2 class="font-display text-[17px] font-bold text-[#202124]">
                {{ section.title }}
              </h2>
              <span class="text-[13px] text-[#80868B] tabular-nums">
                {{ i18n.t('showcase.recWithin', { days: section.thresholdDays }) }}
              </span>
            </div>
            <span class="text-[13px] font-medium text-[#5F6368] tabular-nums">
              {{ section.rows.length }}
            </span>
          </div>

          @if (section.rows.length === 0) {
            <p class="py-3.5 border-t border-[#E8EAED] text-[15px] text-[#80868B]">
              {{ section.emptyText }}
            </p>
          } @else {
            <div class="w-full overflow-x-auto lg:overflow-x-clip sheet-scroll">
              <table class="w-full border-separate border-spacing-0 text-left font-sans text-[15px] text-[#202124]">
                <thead>
                  <tr class="text-[13px] font-medium text-[#5F6368]">
                    <th scope="col" class="py-2.5 pr-5 min-w-[180px] xl:min-w-[220px] w-[24%] font-medium bg-white lg:sticky lg:top-14 z-20 border-t border-b border-[#E8EAED]">{{ i18n.t('showcase.colActivity') }}</th>
                    <th scope="col" class="py-2.5 px-3 w-[100px] xl:w-[112px] font-medium whitespace-nowrap bg-white lg:sticky lg:top-14 z-20 border-t border-b border-[#E8EAED]">{{ i18n.t('showcase.recRefDate') }}</th>
                    <th scope="col" class="py-2.5 px-3 w-[112px] xl:w-[124px] font-medium whitespace-nowrap bg-white lg:sticky lg:top-14 z-20 border-t border-b border-[#E8EAED]">{{ i18n.t('showcase.recWhen') }}</th>
                    <th scope="col" class="py-2.5 px-2 w-[36px] xl:w-[42px] text-right font-medium bg-white lg:sticky lg:top-14 z-20 border-t border-b border-[#E8EAED]" [title]="i18n.t('showcase.colYTitle')">{{ i18n.t('showcase.colY') }}</th>
                    <th scope="col" class="py-2.5 px-2 w-[36px] xl:w-[42px] text-right font-medium bg-white lg:sticky lg:top-14 z-20 border-t border-b border-[#E8EAED]" [title]="i18n.t('showcase.colMTitle')">{{ i18n.t('showcase.colM') }}</th>
                    <th scope="col" class="py-2.5 px-2 w-[36px] xl:w-[42px] text-right font-medium bg-white lg:sticky lg:top-14 z-20 border-t border-b border-[#E8EAED]" [title]="i18n.t('showcase.colWTitle')">{{ i18n.t('showcase.colW') }}</th>
                    <th scope="col" class="py-2.5 px-2 w-[36px] xl:w-[42px] text-right font-medium bg-white lg:sticky lg:top-14 z-20 border-t border-b border-[#E8EAED]" [title]="i18n.t('showcase.colDTitle')">{{ i18n.t('showcase.colD') }}</th>
                    <th scope="col" class="py-2.5 pl-5 xl:pl-6 min-w-[260px] xl:min-w-[330px] font-medium bg-white lg:sticky lg:top-14 z-20 border-t border-b border-[#E8EAED]">
                      {{ i18n.t('showcase.colMessages') }} <span class="font-normal text-[#80868B]">{{ i18n.t('showcase.colMessagesHint') }}</span>
                    </th>
                    <th scope="col" class="py-2.5 pl-3 w-10 xl:w-11 text-right font-medium bg-white lg:sticky lg:top-14 z-20 border-t border-b border-[#E8EAED]">
                      <span class="sr-only">{{ i18n.t('showcase.colShare') }}</span>
                    </th>
                  </tr>
                </thead>

                <tbody>
                  @for (row of section.rows; track row.match.id) {
                    <tr class="hover:bg-[#FAFAFA] transition-colors">
                      <!-- Bold Google 4-Color Activity Title -->
                      <td class="py-3.5 pr-5 align-middle border-b border-[#F1F3F4]">
                        <span [class]="'block text-[16px] font-bold leading-snug break-words ' + row.match.palette.inkClass">
                          {{ row.match.goalTitle }}
                        </span>
                      </td>

                      <!-- Data!G:G Reference Date: =IF($C4="", $D4, $C4) -->
                      <td class="py-3.5 px-3 align-middle text-[15px] text-[#3C4043] tabular-nums whitespace-nowrap border-b border-[#F1F3F4]">
                        {{ row.referenceDateIso ? formatDate(row.referenceDateIso) : '—' }}
                      </td>

                      <!-- Countdown + Target Date -->
                      <td class="py-3.5 px-3 align-middle tabular-nums whitespace-nowrap border-b border-[#F1F3F4]">
                        <div class="text-[15px] font-semibold text-[#202124]">
                          {{ countdownLabel(row.match) }}
                        </div>
                        <div class="text-[13px] text-[#80868B]">
                          {{ formatDate(row.match.recurrenceDate) }}
                        </div>
                      </td>

                      <!-- 4 Separate Pure Numeric A / M / S / G Columns (zero y/m/w/d letters) -->
                      <td class="py-3.5 px-2 text-right align-middle text-[15px] text-[#3C4043] tabular-nums border-b border-[#F1F3F4]">
                        {{ row.years !== null ? row.years : '—' }}
                      </td>
                      <td class="py-3.5 px-2 text-right align-middle text-[15px] text-[#3C4043] tabular-nums border-b border-[#F1F3F4]">
                        {{ row.months !== null ? row.months : '—' }}
                      </td>
                      <td class="py-3.5 px-2 text-right align-middle text-[15px] text-[#3C4043] tabular-nums border-b border-[#F1F3F4]">
                        {{ row.weeks !== null ? row.weeks : '—' }}
                      </td>
                      <td class="py-3.5 px-2 text-right align-middle text-[15px] text-[#3C4043] tabular-nums border-b border-[#F1F3F4]">
                        {{ row.days !== null ? row.days : '—' }}
                      </td>

                      <!-- Dual Copyable Share Messages -->
                      <td class="py-3 pl-5 xl:pl-6 align-middle border-b border-[#F1F3F4]">
                        <div class="flex flex-col gap-1">
                          <button
                            type="button"
                            (click)="copyMessage(row.match.id + ':days', row.shareDaysMessage)"
                            [attr.aria-label]="'Copia: ' + row.shareDaysMessage"
                            class="group/msg w-full text-left flex items-center justify-between gap-3 px-2.5 py-1 -mx-2.5 rounded-lg hover:bg-[#F1F3F4]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A73E8] transition-colors cursor-pointer"
                          >
                            <span class="text-[15px] text-[#202124] leading-snug break-words">
                              {{ row.shareDaysMessage }}
                            </span>
                            <span
                              [class]="
                                copiedKey() === row.match.id + ':days'
                                  ? 'inline-flex items-center gap-1 text-xs font-medium text-[#188038] shrink-0'
                                  : 'inline-flex items-center gap-1 text-xs text-[#80868B] opacity-0 group-hover/msg:opacity-100 group-focus-visible/msg:opacity-100 transition-opacity shrink-0'
                              "
                            >
                              <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">
                                {{ copiedKey() === row.match.id + ':days' ? 'check' : 'content_copy' }}
                              </mat-icon>
                              @if (copiedKey() === row.match.id + ':days') {
                                <span>{{ i18n.t('common.copied') }}</span>
                              }
                            </span>
                          </button>

                          <button
                            type="button"
                            (click)="copyMessage(row.match.id + ':ymw', row.shareYmwMessage)"
                            [attr.aria-label]="'Copia: ' + row.shareYmwMessage"
                            class="group/msg w-full text-left flex items-center justify-between gap-3 px-2.5 py-1 -mx-2.5 rounded-lg hover:bg-[#F1F3F4]/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1A73E8] transition-colors cursor-pointer"
                          >
                            <span class="text-[15px] text-[#5F6368] leading-snug break-words">
                              {{ row.shareYmwMessage }}
                            </span>
                            <span
                              [class]="
                                copiedKey() === row.match.id + ':ymw'
                                  ? 'inline-flex items-center gap-1 text-xs font-medium text-[#188038] shrink-0'
                                  : 'inline-flex items-center gap-1 text-xs text-[#80868B] opacity-0 group-hover/msg:opacity-100 group-focus-visible/msg:opacity-100 transition-opacity shrink-0'
                              "
                            >
                              <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">
                                {{ copiedKey() === row.match.id + ':ymw' ? 'check' : 'content_copy' }}
                              </mat-icon>
                              @if (copiedKey() === row.match.id + ':ymw') {
                                <span>{{ i18n.t('common.copied') }}</span>
                              }
                            </span>
                          </button>
                        </div>
                      </td>

                      <!-- Social Card Share Trigger -->
                      <td class="py-3 pl-3 text-right align-middle border-b border-[#F1F3F4]">
                        <button
                          type="button"
                          (click)="store.openSocialShareById(row.match.goalId)"
                          [title]="i18n.t('data.shareCardAria', { title: row.match.goalTitle })"
                          [attr.aria-label]="i18n.t('data.shareCardAria', { title: row.match.goalTitle })"
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
          }
        </div>
      }
    </section>
  `,
})
export class ShowcaseRecurrences {
  protected readonly store = inject(WorkspaceStore);
  protected readonly i18n = inject(I18nService);
  protected readonly formatDate = formatDateShort;
  protected readonly copiedKey = signal<string | null>(null);
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly compartments = computed<readonly ShowcaseCompartment[]>(() => {
    // Depend on active language so compartment titles update reactively
    this.i18n.lang();
    const rec = this.store.recurrences();
    const thresholds = this.store.profile().thresholds;
    const enrichedById = new Map<string, EnrichedGoal>(
      this.store.enrichedGoals().map((e) => [e.goal.id, e]),
    );

    const mapRows = (matches: readonly RecurrenceMatch[]): ShowcaseRecurrenceRow[] =>
      matches.map((match) => {
        const enriched = enrichedById.get(match.goalId);
        const breakdown = enriched?.metrics.breakdown ?? match.exactBreakdown;
        return {
          match,
          referenceDateIso: enriched ? getGoalReferenceDate(enriched.goal) : match.startDate,
          years: breakdown.years,
          months: breakdown.months,
          weeks: breakdown.weeks,
          days: breakdown.days,
          shareDaysMessage: enriched?.metrics.shareDaysMessage ?? match.label,
          shareYmwMessage: enriched?.metrics.shareYmwMessage ?? match.label,
        };
      });

    return [
      {
        id: 'anniversaries',
        title: this.i18n.t('showcase.recAnniversaries'),
        thresholdDays: thresholds.anniversaryDays,
        emptyText: this.i18n.t('showcase.recEmptyAnniv'),
        rows: mapRows(rec.anniversaries),
      },
      {
        id: 'monthiversaries',
        title: this.i18n.t('showcase.recMonthiversaries'),
        thresholdDays: thresholds.monthiversaryDays,
        emptyText: this.i18n.t('showcase.recEmptyMonth'),
        rows: mapRows(rec.monthiversaries),
      },
      {
        id: 'weekiversaries',
        title: this.i18n.t('showcase.recWeekiversaries'),
        thresholdDays: thresholds.weekiversaryDays,
        emptyText: this.i18n.t('showcase.recEmptyWeek'),
        rows: mapRows(rec.weekiversaries),
      },
      {
        id: 'milestones',
        title: this.i18n.t('showcase.recMilestones'),
        thresholdDays: thresholds.milestoneDays,
        emptyText: this.i18n.t('showcase.recEmptyMilestone'),
        rows: mapRows(rec.milestones),
      },
    ];
  });

  protected countdownLabel(m: RecurrenceMatch): string {
    if (m.daysUntil === 0) return this.i18n.t('showcase.recToday');
    if (m.daysUntil === 1) return this.i18n.t('common.tomorrow');
    return this.i18n.t('common.inDays', { days: m.daysUntil });
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
