import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { RecurrenceMatch } from '../../core/domain/entities/models';
import { formatCompactYmw, formatDateShort } from '../../core/domain/services/calendar-duration';
import { WorkspaceStore } from '../../core/main/workspace-store';

@Component({
  selector: 'app-recurrences-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    <div class="space-y-5 w-full">
      <!-- Threshold Configuration Bar (4 Sliders preserved, full fluid width) -->
      <section class="bg-[#F8F9FA] border border-[#DADCE0] rounded-xl p-5 space-y-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="font-display text-lg font-bold text-[#202124]">
              Ricorrenze in arrivo
            </h2>
            <p class="text-sm text-[#5F6368] mt-0.5">
              Valori interi esatti entro N giorni: Anniversario (0m 0w 0d) · Mesiversario (0w 0d) · Settimaniversario (0d) · Traguardi.
            </p>
          </div>
          <span class="text-sm font-semibold text-[#1A73E8] tabular-nums">
            {{ store.recurrences().totalCount }} rilevate
          </span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <label class="bg-white border border-[#DADCE0] rounded-lg px-3.5 py-2.5 flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-[#202124] flex items-center justify-between">
              <span>Anniversari</span>
              <span class="font-bold text-[#1A73E8] tabular-nums">
                ≤ {{ store.profile().thresholds.anniversaryDays }} gg
              </span>
            </span>
            <input
              type="range"
              min="1"
              max="30"
              [value]="store.profile().thresholds.anniversaryDays"
              (input)="updateThreshold('anniversaryDays', $event)"
              aria-label="Soglia giorni per anniversari"
              class="accent-[#1A73E8] cursor-pointer"
            />
          </label>

          <label class="bg-white border border-[#DADCE0] rounded-lg px-3.5 py-2.5 flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-[#202124] flex items-center justify-between">
              <span>Mesiversari</span>
              <span class="font-bold text-[#D93025] tabular-nums">
                ≤ {{ store.profile().thresholds.monthiversaryDays }} gg
              </span>
            </span>
            <input
              type="range"
              min="1"
              max="15"
              [value]="store.profile().thresholds.monthiversaryDays"
              (input)="updateThreshold('monthiversaryDays', $event)"
              aria-label="Soglia giorni per mesiversari"
              class="accent-[#D93025] cursor-pointer"
            />
          </label>

          <label class="bg-white border border-[#DADCE0] rounded-lg px-3.5 py-2.5 flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-[#202124] flex items-center justify-between">
              <span>Settimaniversari</span>
              <span class="font-bold text-[#C27800] tabular-nums">
                ≤ {{ store.profile().thresholds.weekiversaryDays }} gg
              </span>
            </span>
            <input
              type="range"
              min="1"
              max="7"
              [value]="store.profile().thresholds.weekiversaryDays"
              (input)="updateThreshold('weekiversaryDays', $event)"
              aria-label="Soglia giorni per settimaniversari"
              class="accent-[#FBBC04] cursor-pointer"
            />
          </label>

          <label class="bg-white border border-[#DADCE0] rounded-lg px-3.5 py-2.5 flex flex-col gap-1.5">
            <span class="text-xs font-semibold text-[#202124] flex items-center justify-between">
              <span>Traguardi Giorni</span>
              <span class="font-bold text-[#188038] tabular-nums">
                ≤ {{ store.profile().thresholds.milestoneDays }} gg
              </span>
            </span>
            <input
              type="range"
              min="1"
              max="30"
              [value]="store.profile().thresholds.milestoneDays"
              (input)="updateThreshold('milestoneDays', $event)"
              aria-label="Soglia giorni per traguardi tondi"
              class="accent-[#188038] cursor-pointer"
            />
          </label>
        </div>
      </section>

      <!-- Four Compartments Stacked in a Single Vertical Column (White rows, bold colored Activity text only) -->
      <div class="flex flex-col gap-5 w-full" data-testid="recurrences-compartments">
        <!-- Compartment 1: Anniversaries -->
        <section class="bg-white border border-[#DADCE0] rounded-xl overflow-hidden">
          <div class="px-5 py-3 bg-[#F8F9FA] border-b border-[#DADCE0] flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <mat-icon class="!text-[20px] !w-[20px] !h-[20px] text-[#1A73E8]">cake</mat-icon>
              <h3 class="font-display text-[15px] font-bold text-[#202124]">Anniversari (0m · 0w · 0d)</h3>
            </div>
            <span class="text-sm font-semibold text-[#5F6368] tabular-nums">
              {{ store.recurrences().anniversaries.length }}
            </span>
          </div>
          @if (store.recurrences().anniversaries.length === 0) {
            <p class="px-5 py-4 text-[15px] text-[#5F6368]">
              Nessun anniversario esatto entro {{ store.profile().thresholds.anniversaryDays }} giorni.
            </p>
          } @else {
            <div class="divide-y divide-[#E8EAED]">
              @for (m of store.recurrences().anniversaries; track m.id) {
                <div class="px-5 py-3.5 bg-white hover:bg-[#F8F9FA] flex items-center justify-between gap-4 font-sans text-[15px]">
                  <div class="min-w-0">
                    <p [class]="'font-bold truncate ' + m.palette.inkClass">{{ m.goalTitle }}</p>
                    <p class="text-[15px] text-[#3C4043] mt-0.5 tabular-nums">
                      {{ m.label }} · {{ formatDate(m.recurrenceDate) }}
                    </p>
                  </div>
                  <div class="text-right shrink-0 tabular-nums">
                    <div class="font-semibold text-[#202124]">
                      {{ countdownLabel(m) }}
                    </div>
                    <div class="text-sm text-[#5F6368]">
                      {{ formatShort(m.exactBreakdown) }}
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </section>

        <!-- Compartment 2: Monthiversaries -->
        <section class="bg-white border border-[#DADCE0] rounded-xl overflow-hidden">
          <div class="px-5 py-3 bg-[#F8F9FA] border-b border-[#DADCE0] flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <mat-icon class="!text-[20px] !w-[20px] !h-[20px] text-[#D93025]">event_repeat</mat-icon>
              <h3 class="font-display text-[15px] font-bold text-[#202124]">Mesiversari (0w · 0d)</h3>
            </div>
            <span class="text-sm font-semibold text-[#5F6368] tabular-nums">
              {{ store.recurrences().monthiversaries.length }}
            </span>
          </div>
          @if (store.recurrences().monthiversaries.length === 0) {
            <p class="px-5 py-4 text-[15px] text-[#5F6368]">
              Nessun mesiversario esatto entro {{ store.profile().thresholds.monthiversaryDays }} giorni.
            </p>
          } @else {
            <div class="divide-y divide-[#E8EAED]">
              @for (m of store.recurrences().monthiversaries; track m.id) {
                <div class="px-5 py-3.5 bg-white hover:bg-[#F8F9FA] flex items-center justify-between gap-4 font-sans text-[15px]">
                  <div class="min-w-0">
                    <p [class]="'font-bold truncate ' + m.palette.inkClass">{{ m.goalTitle }}</p>
                    <p class="text-[15px] text-[#3C4043] mt-0.5 tabular-nums">
                      {{ m.label }} · {{ formatDate(m.recurrenceDate) }}
                    </p>
                  </div>
                  <div class="text-right shrink-0 tabular-nums">
                    <div class="font-semibold text-[#202124]">
                      {{ countdownLabel(m) }}
                    </div>
                    <div class="text-sm text-[#5F6368]">
                      {{ formatShort(m.exactBreakdown) }}
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </section>

        <!-- Compartment 3: Weekiversaries -->
        <section class="bg-white border border-[#DADCE0] rounded-xl overflow-hidden">
          <div class="px-5 py-3 bg-[#F8F9FA] border-b border-[#DADCE0] flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <mat-icon class="!text-[20px] !w-[20px] !h-[20px] text-[#C27800]">date_range</mat-icon>
              <h3 class="font-display text-[15px] font-bold text-[#202124]">Settimaniversari (0d esatti)</h3>
            </div>
            <span class="text-sm font-semibold text-[#5F6368] tabular-nums">
              {{ store.recurrences().weekiversaries.length }}
            </span>
          </div>
          @if (store.recurrences().weekiversaries.length === 0) {
            <p class="px-5 py-4 text-[15px] text-[#5F6368]">
              Nessun settimaniversario esatto entro {{ store.profile().thresholds.weekiversaryDays }} giorni.
            </p>
          } @else {
            <div class="divide-y divide-[#E8EAED]">
              @for (m of store.recurrences().weekiversaries; track m.id) {
                <div class="px-5 py-3.5 bg-white hover:bg-[#F8F9FA] flex items-center justify-between gap-4 font-sans text-[15px]">
                  <div class="min-w-0">
                    <p [class]="'font-bold truncate ' + m.palette.inkClass">{{ m.goalTitle }}</p>
                    <p class="text-[15px] text-[#3C4043] mt-0.5 tabular-nums">
                      {{ m.label }} · {{ formatDate(m.recurrenceDate) }}
                    </p>
                  </div>
                  <div class="text-right shrink-0 tabular-nums">
                    <div class="font-semibold text-[#202124]">
                      {{ countdownLabel(m) }}
                    </div>
                    <div class="text-sm text-[#5F6368]">
                      {{ formatShort(m.exactBreakdown) }}
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </section>

        <!-- Compartment 4: Round-Day Milestones -->
        <section class="bg-white border border-[#DADCE0] rounded-xl overflow-hidden">
          <div class="px-5 py-3 bg-[#F8F9FA] border-b border-[#DADCE0] flex items-center justify-between">
            <div class="flex items-center gap-2.5">
              <mat-icon class="!text-[20px] !w-[20px] !h-[20px] text-[#188038]">emoji_events</mat-icon>
              <h3 class="font-display text-[15px] font-bold text-[#202124]">Traguardi Giorni (50, 100, 500, 1000…)</h3>
            </div>
            <span class="text-sm font-semibold text-[#5F6368] tabular-nums">
              {{ store.recurrences().milestones.length }}
            </span>
          </div>
          @if (store.recurrences().milestones.length === 0) {
            <p class="px-5 py-4 text-[15px] text-[#5F6368]">
              Nessun traguardo tondo entro {{ store.profile().thresholds.milestoneDays }} giorni.
            </p>
          } @else {
            <div class="divide-y divide-[#E8EAED]">
              @for (m of store.recurrences().milestones; track m.id) {
                <div class="px-5 py-3.5 bg-white hover:bg-[#F8F9FA] flex items-center justify-between gap-4 font-sans text-[15px]">
                  <div class="min-w-0">
                    <p [class]="'font-bold truncate ' + m.palette.inkClass">{{ m.goalTitle }}</p>
                    <p class="text-[15px] text-[#3C4043] mt-0.5 tabular-nums">
                      {{ m.label }} · {{ formatDate(m.recurrenceDate) }}
                    </p>
                  </div>
                  <div class="text-right shrink-0 tabular-nums">
                    <div class="font-semibold text-[#202124]">
                      {{ countdownLabel(m) }}
                    </div>
                    <div class="text-sm text-[#5F6368]">
                      {{ m.exactBreakdown.totalDays }} days
                    </div>
                  </div>
                </div>
              }
            </div>
          }
        </section>
      </div>
    </div>
  `,
})
export class RecurrencesView {
  protected readonly store = inject(WorkspaceStore);
  protected readonly formatShort = formatCompactYmw;
  protected readonly formatDate = formatDateShort;

  protected countdownLabel(m: RecurrenceMatch): string {
    if (m.daysUntil === 0) return 'OGGI';
    if (m.daysUntil === 1) return 'Domani';
    return `Tra ${m.daysUntil} gg`;
  }

  protected updateThreshold(
    key: 'anniversaryDays' | 'monthiversaryDays' | 'weekiversaryDays' | 'milestoneDays',
    event: Event,
  ): void {
    const val = Number((event.target as HTMLInputElement).value);
    if (Number.isNaN(val)) return;
    void this.store.updateProfilePatch({
      thresholds: {
        ...this.store.profile().thresholds,
        [key]: val,
      },
    });
  }
}
