import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { GoalCompletionFilter, GoalSortKey } from '../../core/domain/entities/models';
import { formatCompactYmw, formatDateShort } from '../../core/domain/services/calendar-duration';
import { WorkspaceStore } from '../../core/main/workspace-store';

@Component({
  selector: 'app-filter-sort-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div class="space-y-4 w-full">
      <!-- Non-Destructive Filter & Sort Controls -->
      <section class="bg-[#F8F9FA] border border-[#DADCE0] rounded-xl p-5 space-y-3.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="font-display text-lg font-bold text-[#202124]">
              Vista FilterSort (Non distruttiva)
            </h2>
            <p class="text-sm text-[#5F6368] mt-0.5">
              Cerca e ordina liberamente senza alterare l’ordine originale delle righe nella scheda Data.
            </p>
          </div>
          <div class="flex items-center gap-2.5">
            <span class="text-sm text-[#5F6368] tabular-nums">
              {{ store.filteredGoals().length }} / {{ store.enrichedGoals().length }} righe
            </span>
            <button
              type="button"
              (click)="store.downloadCsv(true)"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-[#DADCE0] text-[#202124] hover:bg-[#F1F3F4] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">download</mat-icon>
              <span>CSV filtrato</span>
            </button>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div class="md:col-span-5">
            <label for="fs-search" class="block text-xs font-semibold text-[#5F6368] mb-1">Ricerca testo</label>
            <input
              id="fs-search"
              type="search"
              [value]="store.filterCriteria().search"
              (input)="onSearch($event)"
              placeholder="Cerca attività o messaggio..."
              class="w-full px-3 py-2 rounded-lg border border-[#DADCE0] bg-white font-sans text-[15px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
            />
          </div>

          <div class="md:col-span-4">
            <label for="fs-sort" class="block text-xs font-semibold text-[#5F6368] mb-1">Ordina per</label>
            <select
              id="fs-sort"
              [value]="store.filterCriteria().sortKey"
              (change)="onSortKey($event)"
              class="w-full px-3 py-2 rounded-lg border border-[#DADCE0] bg-white font-sans text-[15px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
            >
              <option value="sortOrder">Ordine originale (Data)</option>
              <option value="primaryDays">Numero di giorni</option>
              <option value="title">Nome attività (A–Z)</option>
              <option value="startDate">Data inizio</option>
              <option value="endDate">Data fine</option>
            </select>
          </div>

          <div class="md:col-span-3 flex items-end gap-2">
            <button
              type="button"
              (click)="toggleSortDir()"
              aria-label="Inverti direzione ordinamento"
              class="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#DADCE0] bg-white hover:bg-[#F1F3F4] text-sm font-medium text-[#202124] cursor-pointer whitespace-nowrap"
            >
              <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">
                {{ store.filterCriteria().sortDir === 'asc' ? 'arrow_upward' : 'arrow_downward' }}
              </mat-icon>
              <span>{{ store.filterCriteria().sortDir === 'asc' ? 'Crescente' : 'Decrescente' }}</span>
            </button>
            <button
              type="button"
              (click)="store.resetFilterCriteria()"
              aria-label="Ripristina filtri"
              class="p-2 rounded-lg border border-[#DADCE0] bg-white hover:bg-[#F1F3F4] text-[#5F6368] cursor-pointer"
            >
              <mat-icon class="!text-[20px] !w-[20px] !h-[20px]">restart_alt</mat-icon>
            </button>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-2 pt-0.5" role="group" aria-label="Filtra completamento">
          @for (opt of completionOptions; track opt.key) {
            <button
              type="button"
              (click)="setCompletion(opt.key)"
              [class]="
                store.filterCriteria().completion === opt.key
                  ? 'px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-[#202124] text-white whitespace-nowrap cursor-pointer'
                  : 'px-3.5 py-1.5 rounded-lg text-xs font-medium bg-white border border-[#DADCE0] text-[#5F6368] hover:text-[#202124] whitespace-nowrap cursor-pointer'
              "
            >
              {{ opt.label }}
            </button>
          }
        </div>
      </section>

      <!-- Filtered Table (Uniform Google-Sheets style: white rows, bold colored Activity text only) -->
      <div class="w-full bg-white border border-[#DADCE0] rounded-xl overflow-hidden">
        @if (store.filteredGoals().length === 0) {
          <div class="p-10 text-center space-y-2">
            <p class="font-semibold text-[15px] text-[#202124]">Nessun risultato con questi filtri</p>
            <button
              type="button"
              (click)="store.resetFilterCriteria()"
              class="text-sm font-medium text-[#1A73E8] hover:underline cursor-pointer"
            >
              Azzera i filtri
            </button>
          </div>
        } @else {
          <div class="overflow-x-auto sheet-scroll">
            <table class="w-full border-collapse text-left font-sans text-[15px] text-[#202124]" data-testid="filtersort-table">
              <thead>
                <tr class="border-b border-[#DADCE0] bg-[#F8F9FA] text-[13px] font-semibold text-[#5F6368] divide-x divide-[#E8EAED]">
                  <th scope="col" class="py-2.5 px-3 w-14 text-right">Orig.</th>
                  <th scope="col" class="py-2.5 px-3 min-w-[220px]">Attività</th>
                  <th scope="col" class="py-2.5 px-3 w-[125px] whitespace-nowrap">Inizio</th>
                  <th scope="col" class="py-2.5 px-3 w-[125px] whitespace-nowrap">Fine</th>
                  <th scope="col" class="py-2.5 px-3 text-right w-24 whitespace-nowrap">Giorni</th>
                  <th scope="col" class="py-2.5 px-3 w-[145px] whitespace-nowrap">A · M · S · G</th>
                  <th scope="col" class="py-2.5 px-3 min-w-[330px]">Messaggi pronti</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#E8EAED]">
                @for (item of store.filteredGoals(); track item.goal.id) {
                  <tr class="bg-white hover:bg-[#F8F9FA] divide-x divide-[#F1F3F4]">
                    <td class="py-3 px-3 text-right text-[15px] text-[#5F6368] tabular-nums">
                      #{{ item.rowIndex }}
                    </td>
                    <td [class]="'py-3 px-3 text-[15px] font-bold ' + item.palette.inkClass">
                      {{ item.goal.title }}
                    </td>
                    <td class="py-3 px-3 text-[15px] text-[#202124] tabular-nums whitespace-nowrap">
                      {{ formatDate(item.goal.startDate) }}
                    </td>
                    <td
                      class="py-3 px-3 text-[15px] tabular-nums whitespace-nowrap"
                      [class.text-[#202124]]="item.goal.endDate !== ''"
                      [class.text-[#80868B]]="item.goal.endDate === ''"
                    >
                      {{ formatDate(item.goal.endDate) }}
                    </td>
                    <td class="py-3 px-3 text-right text-[15px] font-medium text-[#202124] tabular-nums whitespace-nowrap">
                      {{ item.metrics.primaryDays ?? '—' }}
                    </td>
                    <td class="py-3 px-3 text-[15px] text-[#202124] tabular-nums whitespace-nowrap">
                      {{ item.metrics.breakdown ? formatShort(item.metrics.breakdown) : '—' }}
                    </td>
                    <td class="py-2.5 px-3">
                      <div class="space-y-1">
                        <div class="flex items-center justify-between gap-2 text-[15px] text-[#202124]">
                          <span>{{ item.metrics.shareDaysMessage }}</span>
                          <button
                            type="button"
                            (click)="copyText(item.goal.id + ':fsd', item.metrics.shareDaysMessage)"
                            aria-label="Copia messaggio giorni"
                            class="p-1 rounded hover:bg-[#E8F0FE]/70 text-[#5F6368] hover:text-[#1A73E8] shrink-0 cursor-pointer"
                          >
                            <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">
                              {{ copiedKey() === item.goal.id + ':fsd' ? 'check' : 'content_copy' }}
                            </mat-icon>
                          </button>
                        </div>
                        <div class="flex items-center justify-between gap-2 text-[15px] text-[#3C4043]">
                          <span>{{ item.metrics.shareYmwMessage }}</span>
                          <button
                            type="button"
                            (click)="copyText(item.goal.id + ':fsy', item.metrics.shareYmwMessage)"
                            aria-label="Copia messaggio A/M/S/G"
                            class="p-1 rounded hover:bg-[#E8F0FE]/70 text-[#5F6368] hover:text-[#1A73E8] shrink-0 cursor-pointer"
                          >
                            <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">
                              {{ copiedKey() === item.goal.id + ':fsy' ? 'check' : 'content_copy' }}
                            </mat-icon>
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
})
export class FilterSortView {
  protected readonly store = inject(WorkspaceStore);
  protected readonly copiedKey = signal<string | null>(null);
  protected readonly formatShort = formatCompactYmw;
  protected readonly formatDate = formatDateShort;

  protected readonly completionOptions: readonly { key: GoalCompletionFilter; label: string }[] = [
    { key: 'all', label: 'Tutti' },
    { key: 'ongoing', label: 'In corso' },
    { key: 'completed', label: 'Completati' },
  ];

  protected onSearch(event: Event): void {
    this.store.updateFilterCriteria({ search: (event.target as HTMLInputElement).value });
  }

  protected onSortKey(event: Event): void {
    this.store.updateFilterCriteria({ sortKey: (event.target as HTMLSelectElement).value as GoalSortKey });
  }

  protected setCompletion(completion: GoalCompletionFilter): void {
    this.store.updateFilterCriteria({ completion });
  }

  protected toggleSortDir(): void {
    const next = this.store.filterCriteria().sortDir === 'asc' ? 'desc' : 'asc';
    this.store.updateFilterCriteria({ sortDir: next });
  }

  protected async copyText(key: string, text: string): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // ignore clipboard fallback
      }
    }
    this.copiedKey.set(key);
    setTimeout(() => {
      if (this.copiedKey() === key) this.copiedKey.set(null);
    }, 1800);
  }
}
