import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { GoalEntry } from '../../core/domain/entities/models';
import { getTodayIsoLocal } from '../../core/domain/services/calendar-duration';
import { MessageLanguage } from '../../core/domain/services/message-generator';
import { WorkspaceStore } from '../../core/main/workspace-store';
import { AutoGrowCell } from '../components/auto-grow-cell';
import { I18nService } from '../services/i18n';

@Component({
  selector: 'app-data-sheet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule, AutoGrowCell],
  template: `
    <div class="space-y-3 w-full">
      <!-- Minimal Single-Row Sheet Toolbar -->
      <div class="flex flex-wrap items-center justify-between gap-3 py-1">
        <div class="flex items-center gap-2.5">
          <button
            type="button"
            (click)="store.showDebugColumns.set(!store.showDebugColumns())"
            [attr.aria-expanded]="store.showDebugColumns()"
            [class]="
              store.showDebugColumns()
                ? 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#202124] text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer'
                : 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-[#DADCE0] text-[#3C4043] hover:bg-[#F8F9FA] transition-colors whitespace-nowrap shrink-0 cursor-pointer'
            "
          >
            <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">
              {{ store.showDebugColumns() ? 'unfold_less' : 'unfold_more' }}
            </mat-icon>
            <span>
              {{ store.showDebugColumns() ? i18n.t('data.hideDebug') : i18n.t('data.showDebug') }}
            </span>
          </button>
        </div>

        <div class="flex flex-wrap items-center gap-2">
          <span class="hidden xl:inline text-xs text-[#5F6368] mr-1">
            {{ i18n.t('data.shortcutsHint') }}
          </span>
          <button
            type="button"
            (click)="store.openImportModal()"
            data-testid="data-import-btn"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-[#DADCE0] text-[#202124] hover:bg-[#F8F9FA] hover:border-[#1A73E8] hover:text-[#1A73E8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">upload</mat-icon>
            <span>{{ i18n.t('data.importBtn') }}</span>
          </button>
          <button
            type="button"
            (click)="store.downloadCsv(false)"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-[#DADCE0] text-[#202124] hover:bg-[#F8F9FA] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">download</mat-icon>
            <span>{{ i18n.t('data.exportCsv') }}</span>
          </button>
          <button
            type="button"
            (click)="store.downloadJsonBackup()"
            data-testid="data-export-json-btn"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-[#DADCE0] text-[#202124] hover:bg-[#F8F9FA] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">data_object</mat-icon>
            <span>{{ i18n.t('data.exportJson') }}</span>
          </button>
        </div>
      </div>

      <!-- Uniform Google-Sheets Style Table (Auto-wrapping multi-line cells, white rows, bold Google 4-color Activity text only) -->
      <div class="w-full bg-white border border-[#DADCE0] rounded-xl overflow-hidden">
        <div class="overflow-x-auto sheet-scroll" #tableWrap>
          <table class="w-full border-collapse text-left font-sans text-[15px] text-[#202124]" data-testid="data-sheet-table">
            <thead>
              <tr class="border-b border-[#DADCE0] bg-[#F8F9FA] text-[13px] font-semibold text-[#5F6368] divide-x divide-[#E8EAED]">
                <th scope="col" class="py-2.5 px-2.5 w-9 text-right">#</th>
                <th scope="col" class="py-2.5 px-3 min-w-[210px]">{{ i18n.t('showcase.colActivity') }}</th>
                <th scope="col" class="py-2.5 px-2.5 w-[142px] whitespace-nowrap">{{ i18n.t('data.colStartDate') }}</th>
                <th scope="col" class="py-2.5 px-2.5 w-[150px] whitespace-nowrap">{{ i18n.t('data.colEndDate') }}</th>
                <th scope="col" class="py-2.5 px-2.5 w-[72px] text-right whitespace-nowrap">{{ i18n.t('showcase.colDays') }}</th>
                <th scope="col" class="py-2.5 px-2.5 w-[128px] whitespace-nowrap">{{ i18n.t('data.colYmw') }}</th>
                <th scope="col" class="py-2.5 px-3 min-w-[280px]">
                  <div class="flex items-center justify-between gap-2">
                    <span>{{ i18n.t('data.colShareMessages') }}</span>
                    <div
                      role="group"
                      [attr.aria-label]="i18n.t('messages.langAria')"
                      class="inline-flex items-center rounded-md border border-[#DADCE0] bg-white p-0.5 shrink-0"
                    >
                      @for (lang of messageLanguages; track lang) {
                        <button
                          type="button"
                          (click)="store.setMessageLanguage(lang)"
                          [attr.aria-pressed]="store.messageLanguage() === lang"
                          [class]="
                            store.messageLanguage() === lang
                              ? 'px-1.5 py-0.5 rounded text-[11px] font-semibold uppercase bg-[#E8F0FE] text-[#174EA6] cursor-pointer'
                              : 'px-1.5 py-0.5 rounded text-[11px] font-medium uppercase text-[#5F6368] hover:text-[#202124] cursor-pointer'
                          "
                        >
                          {{ lang }}
                        </button>
                      }
                    </div>
                  </div>
                </th>
                <th scope="col" class="py-2.5 px-1.5 w-[72px] text-center">
                  <span class="sr-only">{{ i18n.t('showcase.colShare') }}</span>
                </th>
                @if (store.showDebugColumns()) {
                  <th scope="col" class="py-2.5 px-3 bg-[#F1F3F4] min-w-[130px]">Scenario</th>
                  <th scope="col" class="py-2.5 px-3 bg-[#F1F3F4] text-right w-24">Signed Δ</th>
                  <th scope="col" class="py-2.5 px-3 bg-[#F1F3F4] min-w-[240px]">Formula Trace</th>
                }
              </tr>
            </thead>

            <tbody class="divide-y divide-[#E8EAED]">
              @if (store.enrichedGoals().length === 0) {
                <tr>
                  <td [attr.colspan]="store.showDebugColumns() ? 11 : 8" class="px-6 py-10 text-center bg-white">
                    <p class="font-semibold text-[15px] text-[#202124]">
                      {{ i18n.t('data.emptyTitle') }}
                    </p>
                    <p class="text-sm text-[#5F6368] mt-1">
                      {{ i18n.t('data.emptyBody') }}
                    </p>
                    <button
                      type="button"
                      (click)="store.loadSampleDataIntoAccount()"
                      class="mt-3 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-[#DADCE0] bg-white hover:bg-[#F8F9FA] text-sm font-medium text-[#202124] cursor-pointer"
                    >
                      <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">dataset</mat-icon>
                      <span>{{ i18n.t('data.loadSample') }}</span>
                    </button>
                  </td>
                </tr>
              }

              @for (item of store.enrichedGoals(); track item.goal.id; let idx = $index) {
                <tr class="bg-white hover:bg-[#F8F9FA] transition-colors divide-x divide-[#F1F3F4]">
                  <!-- Row # -->
                  <td class="py-2.5 px-2.5 text-right text-[15px] text-[#5F6368] tabular-nums align-middle">
                    {{ item.rowIndex }}
                  </td>

                  <!-- Auto-wrapping, auto-expanding inline Activity cell (ONLY cell with Google 4-color bold text) -->
                  <td class="py-1.5 px-1.5 align-middle">
                    <app-auto-grow-cell
                      [value]="item.goal.title"
                      [ariaLabel]="'Titolo riga ' + item.rowIndex"
                      [textClass]="'font-bold ' + item.palette.inkClass"
                      [maxLength]="160"
                      [rowIndex]="idx"
                      colKey="title"
                      (committed)="commitTitle(item.goal, $event)"
                      (navigateVertical)="moveFocusVertical(idx, 'title', $event)"
                    />
                  </td>

                  <!-- Inline Editable Start Date -->
                  <td class="py-1.5 px-1.5 align-middle">
                    <input
                      type="date"
                      [value]="item.goal.startDate"
                      (change)="commitDate(item.goal, 'startDate', $event)"
                      (keydown)="onDateKeydown($event, idx, 'startDate')"
                      [attr.aria-label]="'Data inizio per ' + item.goal.title"
                      [attr.data-cell-row]="idx"
                      data-cell-col="startDate"
                      class="w-full px-1.5 py-1.5 rounded-md bg-transparent hover:bg-[#F1F3F4]/60 focus:bg-white border border-transparent focus:border-[#1A73E8] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/20 font-sans text-[15px] text-[#202124] tabular-nums transition-colors cursor-pointer"
                    />
                  </td>

                  <!-- Inline Editable End Date with quick-clear X -->
                  <td class="py-1.5 px-1.5 align-middle group/end">
                    <div class="flex items-center gap-0.5">
                      <input
                        type="date"
                        [value]="item.goal.endDate"
                        (change)="commitDate(item.goal, 'endDate', $event)"
                        (keydown)="onDateKeydown($event, idx, 'endDate')"
                        [attr.aria-label]="'Data fine per ' + item.goal.title"
                        [attr.data-cell-row]="idx"
                        data-cell-col="endDate"
                        class="w-full min-w-0 px-1.5 py-1.5 rounded-md bg-transparent hover:bg-[#F1F3F4]/60 focus:bg-white border border-transparent focus:border-[#1A73E8] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/20 font-sans text-[15px] tabular-nums transition-colors cursor-pointer"
                        [class.text-[#202124]]="item.goal.endDate !== ''"
                        [class.text-[#80868B]]="item.goal.endDate === ''"
                      />
                      @if (item.goal.endDate !== '') {
                        <button
                          type="button"
                          (click)="clearEndDate(item.goal)"
                          title="Rimuovi data fine"
                          [attr.aria-label]="'Rimuovi data fine per ' + item.goal.title"
                          class="p-0.5 rounded text-[#80868B] hover:text-[#D93025] hover:bg-[#FCE8E6]/60 opacity-0 group-hover/end:opacity-100 focus:opacity-100 transition-opacity shrink-0 cursor-pointer"
                        >
                          <mat-icon class="!text-[15px] !w-[15px] !h-[15px]">close</mat-icon>
                        </button>
                      }
                    </div>
                  </td>

                  <!-- READ-ONLY BACKEND: Primary Days -->
                  <td
                    class="py-2.5 px-2.5 text-right align-middle text-[15px] font-medium text-[#202124] tabular-nums select-text whitespace-nowrap"
                    title="Calcolato automaticamente (sola lettura)"
                  >
                    {{ item.metrics.primaryDays !== null ? item.metrics.primaryDays : '—' }}
                  </td>

                  <!-- READ-ONLY BACKEND: Y / M / W / D -->
                  <td
                    class="py-2.5 px-2.5 align-middle text-[15px] text-[#202124] tabular-nums select-text whitespace-nowrap"
                    title="Equivalente calendario esatto (sola lettura)"
                  >
                    {{ item.metrics.compactYmw }}
                  </td>

                  <!-- READ-ONLY BACKEND: Dual Copyable Share Messages -->
                  <td class="py-2.5 px-3 align-middle">
                    <div class="space-y-1">
                      <div class="flex items-center justify-between gap-2">
                        <span class="text-[15px] text-[#202124] leading-snug select-all break-words">
                          {{ item.metrics.shareDaysMessage }}
                        </span>
                        <button
                          type="button"
                          (click)="copyMessage(item.goal.id + ':days', item.metrics.shareDaysMessage)"
                          [title]="copiedKey() === item.goal.id + ':days' ? 'Copiato!' : 'Copia messaggio'"
                          [attr.aria-label]="'Copia messaggio giorni: ' + item.metrics.shareDaysMessage"
                          [class]="
                            copiedKey() === item.goal.id + ':days'
                              ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold text-[#188038] bg-[#E6F4EA] shrink-0 cursor-pointer'
                              : 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-[#5F6368] hover:text-[#1A73E8] hover:bg-[#E8F0FE]/70 shrink-0 transition-colors cursor-pointer'
                          "
                        >
                          <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">
                            {{ copiedKey() === item.goal.id + ':days' ? 'check' : 'content_copy' }}
                          </mat-icon>
                          @if (copiedKey() === item.goal.id + ':days') {
                            <span>{{ i18n.t('common.copied') }}</span>
                          }
                        </button>
                      </div>

                      <div class="flex items-center justify-between gap-2">
                        <span class="text-[15px] text-[#3C4043] leading-snug select-all break-words">
                          {{ item.metrics.shareYmwMessage }}
                        </span>
                        <button
                          type="button"
                          (click)="copyMessage(item.goal.id + ':ymw', item.metrics.shareYmwMessage)"
                          [title]="copiedKey() === item.goal.id + ':ymw' ? 'Copiato!' : 'Copia messaggio'"
                          [attr.aria-label]="'Copia messaggio A/M/S/G: ' + item.metrics.shareYmwMessage"
                          [class]="
                            copiedKey() === item.goal.id + ':ymw'
                              ? 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold text-[#188038] bg-[#E6F4EA] shrink-0 cursor-pointer'
                              : 'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-[#5F6368] hover:text-[#1A73E8] hover:bg-[#E8F0FE]/70 shrink-0 transition-colors cursor-pointer'
                          "
                        >
                          <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">
                            {{ copiedKey() === item.goal.id + ':ymw' ? 'check' : 'content_copy' }}
                          </mat-icon>
                          @if (copiedKey() === item.goal.id + ':ymw') {
                            <span>{{ i18n.t('common.copied') }}</span>
                          }
                        </button>
                      </div>
                    </div>
                  </td>

                  <!-- Share Card & Delete row actions -->
                  <td class="py-2.5 px-1.5 text-center align-middle">
                    <div class="inline-flex items-center gap-0.5">
                      <button
                        type="button"
                        (click)="store.openSocialShare(item)"
                        [title]="i18n.t('data.shareCardAria', { title: item.goal.title })"
                        [attr.aria-label]="i18n.t('data.shareCardAria', { title: item.goal.title })"
                        class="p-1.5 rounded-md text-[#5F6368] hover:text-[#1A73E8] hover:bg-[#E8F0FE]/70 transition-colors cursor-pointer"
                      >
                        <mat-icon class="!text-[17px] !w-[17px] !h-[17px]">share</mat-icon>
                      </button>
                      <button
                        type="button"
                        (click)="deleteGoal(item.goal)"
                        [attr.aria-label]="'Elimina riga ' + item.goal.title"
                        class="p-1.5 rounded-md text-[#5F6368] hover:text-[#D93025] hover:bg-[#FCE8E6]/60 transition-colors cursor-pointer"
                      >
                        <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">delete_outline</mat-icon>
                      </button>
                    </div>
                  </td>

                  <!-- Expandable Debug Columns -->
                  @if (store.showDebugColumns()) {
                    <td class="py-2.5 px-3 align-middle bg-[#F8F9FA] text-sm text-[#202124]">
                      {{ item.metrics.scenario }}
                    </td>
                    <td class="py-2.5 px-3 text-right align-middle bg-[#F8F9FA] text-sm tabular-nums text-[#202124]">
                      {{ item.metrics.signedDays ?? '—' }}
                    </td>
                    <td class="py-2.5 px-3 align-middle bg-[#F8F9FA] text-xs text-[#5F6368] break-words">
                      {{ item.metrics.debugFormulaTrace }}
                    </td>
                  }
                </tr>
              }

              <!-- Inline "+ Aggiungi riga" Entry Row (with auto-wrapping title textarea) -->
              <tr
                class="bg-[#F8F9FA] border-t border-[#DADCE0] divide-x divide-[#E8EAED]"
                [formGroup]="newRowForm"
                data-testid="inline-new-row"
              >
                <td class="py-2.5 px-2.5 text-right text-[15px] text-[#1A73E8] font-bold align-middle">
                  +
                </td>
                <td class="py-2 px-1.5 align-middle">
                  <div class="grid w-full">
                    <div
                      aria-hidden="true"
                      class="col-start-1 row-start-1 invisible pointer-events-none select-none whitespace-pre-wrap break-words px-2.5 py-1.5 border border-transparent font-sans text-[15px] leading-snug min-h-[34px]"
                    >{{ (newRowTitleMirror() || i18n.t('data.newRowPlaceholder')) + '\u200b' }}</div>
                    <textarea
                      #newRowTitleInput
                      rows="1"
                      formControlName="title"
                      (input)="newRowTitleMirror.set(newRowForm.controls.title.value)"
                      (keydown)="onNewRowTitleKeydown($event)"
                      maxlength="160"
                      [placeholder]="i18n.t('data.newRowPlaceholder')"
                      [attr.aria-label]="i18n.t('data.newRowPlaceholder')"
                      data-cell-col="title"
                      [attr.data-cell-row]="store.enrichedGoals().length"
                      class="col-start-1 row-start-1 w-full h-full resize-none overflow-hidden whitespace-pre-wrap break-words px-2.5 py-1.5 rounded-md bg-white border border-[#DADCE0] focus:border-[#1A73E8] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/20 font-sans text-[15px] leading-snug text-[#202124] placeholder:text-[#80868B]"
                    ></textarea>
                  </div>
                </td>
                <td class="py-2 px-1.5 align-middle">
                  <input
                    type="date"
                    formControlName="startDate"
                    (keydown.enter)="submitNewRow()"
                    [attr.aria-label]="i18n.t('data.colStartDate')"
                    data-cell-col="startDate"
                    [attr.data-cell-row]="store.enrichedGoals().length"
                    class="w-full px-1.5 py-1.5 rounded-md bg-white border border-[#DADCE0] focus:border-[#1A73E8] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/20 font-sans text-[15px] text-[#202124] tabular-nums"
                  />
                </td>
                <td class="py-2 px-1.5 align-middle">
                  <input
                    type="date"
                    formControlName="endDate"
                    (keydown.enter)="submitNewRow()"
                    [attr.aria-label]="i18n.t('data.colEndDate')"
                    data-cell-col="endDate"
                    [attr.data-cell-row]="store.enrichedGoals().length"
                    class="w-full px-1.5 py-1.5 rounded-md bg-white border border-[#DADCE0] focus:border-[#1A73E8] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/20 font-sans text-[15px] text-[#5F6368] tabular-nums"
                  />
                </td>
                <td [attr.colspan]="store.showDebugColumns() ? 7 : 4" class="py-2 px-3 align-middle">
                  <div class="flex items-center justify-between gap-3">
                    <span class="text-sm text-[#5F6368]">
                      {{ i18n.t('data.newRowHint') }}
                    </span>
                    <button
                      type="button"
                      (click)="submitNewRow()"
                      [disabled]="newRowForm.invalid"
                      class="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-sm font-medium transition-colors disabled:opacity-45 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">add</mat-icon>
                      <span>{{ i18n.t('data.addRow') }}</span>
                    </button>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `,
})
export class DataSheet {
  protected readonly store = inject(WorkspaceStore);
  protected readonly i18n = inject(I18nService);
  protected readonly messageLanguages: readonly MessageLanguage[] = ['en', 'it', 'es'];
  protected readonly copiedKey = signal<string | null>(null);
  protected readonly newRowTitleMirror = signal<string>('');
  private readonly newRowTitleInput = viewChild<ElementRef<HTMLTextAreaElement>>('newRowTitleInput');
  private readonly tableWrap = viewChild<ElementRef<HTMLDivElement>>('tableWrap');
  private copyTimer: ReturnType<typeof setTimeout> | null = null;

  protected readonly newRowForm = new FormGroup({
    title: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    startDate: new FormControl(getTodayIsoLocal(), { nonNullable: true }),
    endDate: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    effect(() => {
      const trigger = this.store.focusNewRowSignal();
      if (trigger > 0) {
        const el = this.newRowTitleInput()?.nativeElement;
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.focus();
        }
      }
    });
  }

  protected async commitTitle(goal: GoalEntry, nextTitle: string): Promise<void> {
    await this.store.updateGoalInline(goal.id, { title: nextTitle });
  }

  protected async commitDate(
    goal: GoalEntry,
    field: 'startDate' | 'endDate',
    event: Event,
  ): Promise<void> {
    const input = event.target as HTMLInputElement;
    const nextVal = input.value;
    const res = await this.store.updateGoalInline(goal.id, { [field]: nextVal });
    if (!res.ok) {
      input.value = goal[field];
    }
  }

  protected async clearEndDate(goal: GoalEntry): Promise<void> {
    await this.store.updateGoalInline(goal.id, { endDate: '' });
  }

  protected onDateKeydown(
    event: KeyboardEvent,
    rowIdx: number,
    col: 'startDate' | 'endDate',
  ): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      this.moveFocusVertical(rowIdx, col, event.shiftKey ? -1 : 1);
    }
  }

  protected onNewRowTitleKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void this.submitNewRow();
    } else if (event.key === 'ArrowUp') {
      const el = event.target as HTMLTextAreaElement;
      if (el.selectionStart === 0 && el.selectionEnd === 0 && this.store.enrichedGoals().length > 0) {
        event.preventDefault();
        this.moveFocusVertical(this.store.enrichedGoals().length, 'title', -1);
      }
    }
  }

  protected moveFocusVertical(fromRow: number, col: string, delta: -1 | 1): void {
    const container = this.tableWrap()?.nativeElement;
    if (!container) return;
    const targetRow = fromRow + delta;
    if (targetRow < 0) return;

    const target = container.querySelector<HTMLElement>(
      `[data-cell-row="${targetRow}"][data-cell-col="${col}"]`,
    );
    if (target) {
      target.focus();
    }
  }

  protected async submitNewRow(): Promise<void> {
    const raw = this.newRowForm.getRawValue();
    if (!raw.title.trim()) return;
    const res = await this.store.addGoal({
      title: raw.title,
      startDate: raw.startDate,
      endDate: raw.endDate,
      notes: '',
    });
    if (res.ok) {
      this.newRowForm.reset({
        title: '',
        startDate: getTodayIsoLocal(),
        endDate: '',
      });
      this.newRowTitleMirror.set('');
    }
  }

  protected deleteGoal(goal: GoalEntry): void {
    void this.store.deleteGoal(goal.id);
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
