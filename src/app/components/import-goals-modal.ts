import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { analyzeGoalImport } from '../../core/domain/services/goal-import-export';
import { WorkspaceStore } from '../../core/main/workspace-store';
import { I18nService } from '../services/i18n';

@Component({
  selector: 'app-import-goals-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule],
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
  template: `
    @if (store.importModalOpen()) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      >
        <button
          type="button"
          (click)="close()"
          [attr.aria-label]="i18n.t('common.close')"
          class="fixed inset-0 bg-black/50 backdrop-blur-[2px] cursor-default"
        ></button>
        <div
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="i18n.t('import.modalTitle')"
          class="relative z-10 bg-white border border-[#DADCE0] rounded-2xl shadow-xl w-full max-w-3xl overflow-hidden my-auto flex flex-col max-h-[90vh]"
        >
          <!-- Header -->
          <div class="px-5 py-4 border-b border-[#E8EAED] flex items-center justify-between gap-3 shrink-0">
            <div class="min-w-0">
              <h2 class="font-display text-base sm:text-lg font-bold text-[#202124] truncate">
                {{ i18n.t('import.modalTitle') }}
              </h2>
              <p class="text-xs text-[#5F6368] mt-0.5">
                {{ i18n.t('import.modalSubtitle') }}
              </p>
            </div>
            <button
              type="button"
              (click)="close()"
              [attr.aria-label]="i18n.t('common.close')"
              class="p-1.5 rounded-lg text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4] transition-colors cursor-pointer shrink-0"
            >
              <mat-icon class="!text-[20px] !w-[20px] !h-[20px]">close</mat-icon>
            </button>
          </div>

          <!-- Body -->
          <div class="p-5 space-y-4 overflow-y-auto">
            <!-- File Upload + Paste Input -->
            <div class="flex flex-wrap items-center gap-3">
              <label
                class="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-[#DADCE0] bg-[#F8F9FA] hover:bg-[#F1F3F4] text-xs font-semibold text-[#202124] cursor-pointer transition-colors"
              >
                <mat-icon class="!text-[17px] !w-[17px] !h-[17px] text-[#1A73E8]">upload_file</mat-icon>
                <span>{{ i18n.t('import.pickFile') }}</span>
                <input
                  type="file"
                  accept=".csv,.json,text/csv,application/json"
                  class="hidden"
                  (change)="onFileSelected($event)"
                />
              </label>

              @if (loadedFilename()) {
                <span class="text-xs font-mono text-[#137333] bg-[#E6F4EA] px-2.5 py-1 rounded-md">
                  {{ loadedFilename() }}
                </span>
              } @else {
                <span class="text-xs text-[#5F6368]">{{ i18n.t('import.orPaste') }}</span>
              }
            </div>

            <textarea
              [formControl]="rawTextControl"
              rows="5"
              [placeholder]="i18n.t('import.pastePlaceholder')"
              data-testid="import-raw-textarea"
              class="w-full rounded-xl border border-[#DADCE0] bg-[#F8F9FA] focus:bg-white px-3.5 py-2.5 text-xs font-mono text-[#202124] placeholder:text-[#80868B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:border-[#1A73E8]"
            ></textarea>

            <!-- Parse Error -->
            @if (analysis().parseError; as err) {
              <div class="rounded-lg bg-[#FCE8E6] border border-[#F6AEA9] px-3.5 py-2.5 text-xs text-[#A50E0E]">
                {{ err }}
              </div>
            }

            <!-- Summary Bar & Duplicate Toggle -->
            @if (analysis().rows.length > 0) {
              <div class="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div class="flex flex-wrap items-center gap-2 text-xs font-semibold">
                  <span class="px-2.5 py-1 rounded-md bg-[#E6F4EA] text-[#137333]" data-testid="import-count-valid">
                    {{ i18n.t('import.summaryValid', { count: analysis().validCount }) }}
                  </span>
                  <span class="px-2.5 py-1 rounded-md bg-[#FEF7E0] text-[#9A5B00]" data-testid="import-count-duplicate">
                    {{ i18n.t('import.summaryDuplicates', { count: analysis().duplicateCount }) }}
                  </span>
                  <span class="px-2.5 py-1 rounded-md bg-[#FCE8E6] text-[#A50E0E]" data-testid="import-count-invalid">
                    {{ i18n.t('import.summaryInvalid', { count: analysis().invalidCount }) }}
                  </span>
                </div>

                <label class="inline-flex items-center gap-2 text-xs text-[#3C4043] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    [formControl]="skipDuplicatesControl"
                    class="rounded border-[#DADCE0] text-[#1A73E8] focus:ring-[#1A73E8]"
                  />
                  <span>{{ i18n.t('import.skipDuplicates') }}</span>
                </label>
              </div>

              <!-- Preview Table -->
              <div class="border border-[#DADCE0] rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table class="w-full text-left border-collapse text-xs">
                  <thead class="bg-[#F8F9FA] text-[#5F6368] uppercase text-[10px] tracking-wider sticky top-0 border-b border-[#DADCE0]">
                    <tr>
                      <th class="px-3 py-2 w-12 font-semibold">#</th>
                      <th class="px-3 py-2 font-semibold">{{ i18n.t('showcase.colActivity') }}</th>
                      <th class="px-3 py-2 w-28 font-semibold">{{ i18n.t('showcase.colStart') }}</th>
                      <th class="px-3 py-2 w-28 font-semibold">{{ i18n.t('showcase.colEnd') }}</th>
                      <th class="px-3 py-2 w-28 font-semibold text-right">Stato</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-[#E8EAED]">
                    @for (row of analysis().rows; track row.lineNumber) {
                      <tr class="bg-white">
                        <td class="px-3 py-2 font-mono text-[#5F6368]">{{ row.lineNumber }}</td>
                        <td class="px-3 py-2 text-[#202124]">
                          <div class="font-medium truncate max-w-[260px]">
                            {{ row.input.title || '—' }}
                          </div>
                          @if (row.errors.length > 0) {
                            <div class="text-[11px] text-[#A50E0E] mt-0.5">{{ row.errors[0] }}</div>
                          }
                        </td>
                        <td class="px-3 py-2 font-mono text-[#3C4043]">{{ row.input.startDate || '—' }}</td>
                        <td class="px-3 py-2 font-mono text-[#3C4043]">{{ row.input.endDate || '—' }}</td>
                        <td class="px-3 py-2 text-right">
                          @if (row.status === 'valid') {
                            <span class="inline-block px-2 py-0.5 rounded bg-[#E6F4EA] text-[#137333] font-semibold">
                              {{ i18n.t('import.statusValid') }}
                            </span>
                          } @else if (row.status === 'duplicate') {
                            <span class="inline-block px-2 py-0.5 rounded bg-[#FEF7E0] text-[#9A5B00] font-semibold">
                              {{ i18n.t('import.statusDuplicate') }}
                            </span>
                          } @else {
                            <span class="inline-block px-2 py-0.5 rounded bg-[#FCE8E6] text-[#A50E0E] font-semibold">
                              {{ i18n.t('import.statusInvalid') }}
                            </span>
                          }
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else if (!analysis().parseError) {
              <p class="text-xs text-[#5F6368] text-center py-4 bg-[#F8F9FA] rounded-xl border border-dashed border-[#DADCE0]">
                {{ i18n.t('import.noRowsHint') }}
              </p>
            }

            @if (importError(); as impErr) {
              <div class="rounded-lg bg-[#FCE8E6] border border-[#F6AEA9] px-3.5 py-2 text-xs text-[#A50E0E]">
                {{ impErr }}
              </div>
            }
          </div>

          <!-- Footer -->
          <div class="px-5 py-3.5 border-t border-[#E8EAED] bg-[#F8F9FA] flex flex-wrap items-center justify-between gap-3 shrink-0">
            <span class="text-[11px] text-[#5F6368]">{{ i18n.t('import.undoHint') }}</span>

            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="close()"
                class="px-3.5 py-2 rounded-lg border border-[#DADCE0] bg-white hover:bg-[#F1F3F4] text-xs font-medium text-[#3C4043] transition-colors cursor-pointer"
              >
                {{ i18n.t('common.cancel') }}
              </button>
              <button
                type="button"
                (click)="confirmImport()"
                [disabled]="readyInputs().length === 0 || importing()"
                data-testid="import-confirm-btn"
                class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">download_done</mat-icon>
                <span>
                  {{
                    importing()
                      ? i18n.t('import.importing')
                      : i18n.t('import.confirmBtn', { count: readyInputs().length })
                  }}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class ImportGoalsModal {
  protected readonly store = inject(WorkspaceStore);
  protected readonly i18n = inject(I18nService);

  protected readonly rawTextControl = new FormControl('', { nonNullable: true });
  protected readonly skipDuplicatesControl = new FormControl(true, { nonNullable: true });

  private readonly rawTextValue = toSignal(this.rawTextControl.valueChanges, { initialValue: '' });
  private readonly skipDuplicatesValue = toSignal(this.skipDuplicatesControl.valueChanges, {
    initialValue: true,
  });

  protected readonly loadedFilename = signal<string | null>(null);
  protected readonly importing = signal<boolean>(false);
  protected readonly importError = signal<string | null>(null);

  protected readonly analysis = computed(() =>
    analyzeGoalImport(this.rawTextValue(), this.store.goals()),
  );

  protected readonly readyInputs = computed(() => {
    const skipDupes = this.skipDuplicatesValue();
    return this.analysis()
      .rows.filter((r) => r.status === 'valid' || (!skipDupes && r.status === 'duplicate'))
      .map((r) => r.input);
  });

  protected onEscape(): void {
    if (this.store.importModalOpen()) {
      this.close();
    }
  }

  protected onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) return;

    this.importError.set(null);
    this.loadedFilename.set(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      const content = typeof reader.result === 'string' ? reader.result : '';
      this.rawTextControl.setValue(content);
    };
    reader.readAsText(file, 'utf-8');
    if (input) {
      input.value = '';
    }
  }

  protected async confirmImport(): Promise<void> {
    const items = this.readyInputs();
    if (items.length === 0 || this.importing()) return;

    this.importing.set(true);
    this.importError.set(null);
    try {
      const res = await this.store.importGoalsBatch(items);
      if (res.ok) {
        this.rawTextControl.setValue('');
        this.loadedFilename.set(null);
        this.store.closeImportModal();
      } else {
        this.importError.set(res.error ?? 'Errore durante l’importazione.');
      }
    } finally {
      this.importing.set(false);
    }
  }

  protected close(): void {
    this.importError.set(null);
    this.store.closeImportModal();
  }
}
