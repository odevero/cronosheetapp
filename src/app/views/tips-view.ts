import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, signal, viewChild } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { TipNote } from '../../core/domain/entities/models';
import { WorkspaceStore } from '../../core/main/workspace-store';
import { AutoGrowCell } from '../components/auto-grow-cell';

@Component({
  selector: 'app-tips-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule, AutoGrowCell],
  template: `
    <div class="space-y-4 w-full">
      <!-- Quick-add Infinite Row Bar (Dropdown bound to Data activities + Auto-wrapping Next Step note) -->
      <section class="bg-[#F8F9FA] border border-[#DADCE0] rounded-xl p-5 space-y-3.5">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="font-display text-lg font-bold text-[#202124]">
              Memo — Prossimi passi immediati
            </h2>
            <p class="text-sm text-[#5F6368] mt-0.5">
              Seleziona un’attività dal menù a tendina della scheda Data e annota il prossimo passo concreto. Puoi modificare ogni cella inline (Ctrl+Z per annullare).
            </p>
          </div>
          <span class="text-sm text-[#5F6368] tabular-nums">
            {{ openCount() }} aperti · {{ store.tips().length }} totali
          </span>
        </div>

        <form [formGroup]="tipForm" (ngSubmit)="submitTip()" class="grid grid-cols-1 lg:grid-cols-12 gap-3 items-end">
          <div class="lg:col-span-4">
            <label for="memo-goal-select" class="block text-xs font-semibold text-[#202124] mb-1">
              Attività (da scheda Data)
            </label>
            <select
              id="memo-goal-select"
              formControlName="goalId"
              class="w-full px-3 py-2 rounded-lg border border-[#DADCE0] bg-white font-sans text-[15px] text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
            >
              <option value="" disabled>Seleziona un’attività…</option>
              @for (g of store.goals(); track g.id) {
                <option [value]="g.id">{{ g.title }}</option>
              }
            </select>
          </div>

          <div class="lg:col-span-7">
            <label for="memo-next-step" class="block text-xs font-semibold text-[#202124] mb-1">
              Prossimo passo / appunto
            </label>
            <div class="grid w-full">
              <div
                aria-hidden="true"
                class="col-start-1 row-start-1 invisible pointer-events-none select-none whitespace-pre-wrap break-words px-3 py-2 border border-transparent font-sans text-[15px] leading-snug min-h-[40px]"
              >{{ (draftNoteMirror() || 'Es. Completare il capitolo 4 entro venerdì...') + '\u200b' }}</div>
              <textarea
                id="memo-next-step"
                rows="1"
                formControlName="nextStep"
                (input)="draftNoteMirror.set(tipForm.controls.nextStep.value)"
                (keydown)="onDraftKeydown($event)"
                maxlength="500"
                placeholder="Es. Completare il capitolo 4 entro venerdì..."
                class="col-start-1 row-start-1 w-full h-full resize-none overflow-hidden whitespace-pre-wrap break-words px-3 py-2 rounded-lg border border-[#DADCE0] bg-white font-sans text-[15px] leading-snug text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
              ></textarea>
            </div>
          </div>

          <div class="lg:col-span-1">
            <button
              type="submit"
              [disabled]="tipForm.invalid || store.goals().length === 0"
              class="w-full inline-flex items-center justify-center gap-1 px-3 py-2 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-sm font-medium transition-colors disabled:opacity-50 whitespace-nowrap cursor-pointer"
            >
              <mat-icon class="!text-[20px] !w-[20px] !h-[20px]">add</mat-icon>
              <span class="lg:hidden">Aggiungi</span>
            </button>
          </div>
        </form>

        @if (formError()) {
          <p role="alert" class="text-xs text-[#D93025]">{{ formError() }}</p>
        }
      </section>

      <!-- Memo Spreadsheet Table (Auto-wrapping inline editable cells, uniform typography, no priority column) -->
      <div class="w-full bg-white border border-[#DADCE0] rounded-xl overflow-hidden">
        @if (store.tips().length === 0) {
          <div class="p-10 text-center space-y-2">
            <p class="font-semibold text-[15px] text-[#202124]">Nessun appunto nella scheda Memo</p>
            <p class="text-sm text-[#5F6368]">
              Usa la riga qui sopra per collegare un prossimo passo a una delle tue attività.
            </p>
          </div>
        } @else {
          <div class="overflow-x-auto sheet-scroll" #tableWrap>
            <table class="w-full border-collapse text-left font-sans text-[15px] text-[#202124]" data-testid="memo-table">
              <thead>
                <tr class="border-b border-[#DADCE0] bg-[#F8F9FA] text-[13px] font-semibold text-[#5F6368] divide-x divide-[#E8EAED]">
                  <th scope="col" class="py-2.5 px-3 w-12 text-center">Stato</th>
                  <th scope="col" class="py-2.5 px-3 w-[320px]">Attività collegata</th>
                  <th scope="col" class="py-2.5 px-3">Appunto / Prossimo passo</th>
                  <th scope="col" class="py-2.5 px-2 w-12 text-center">
                    <span class="sr-only">Elimina</span>
                  </th>
                </tr>
              </thead>
              <tbody class="divide-y divide-[#E8EAED]">
                @for (tip of store.tips(); track tip.id; let idx = $index) {
                  <tr [class]="tip.done ? 'bg-[#F8F9FA]/70 opacity-75 divide-x divide-[#F1F3F4]' : 'bg-white hover:bg-[#F8F9FA] divide-x divide-[#F1F3F4]'">
                    <td class="py-3 px-3 text-center align-middle">
                      <input
                        type="checkbox"
                        [checked]="tip.done"
                        (change)="store.toggleTipDone(tip)"
                        [attr.aria-label]="'Segna come completato: ' + tip.nextStep"
                        class="w-4 h-4 accent-[#188038] cursor-pointer"
                      />
                    </td>

                    <td class="py-2 px-2 align-middle">
                      <select
                        (change)="onGoalChange(tip, $event)"
                        [attr.aria-label]="'Cambia attività collegata per ' + tip.nextStep"
                        class="w-full px-2.5 py-1.5 rounded-md border border-transparent hover:border-[#DADCE0] focus:border-[#1A73E8] bg-transparent hover:bg-white focus:bg-white font-sans text-[15px] font-medium text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/20 cursor-pointer"
                      >
                        @for (g of store.goals(); track g.id) {
                          <option [value]="g.id" [selected]="g.id === tip.goalId">{{ g.title }}</option>
                        }
                      </select>
                    </td>

                    <td class="py-1.5 px-1.5 align-middle">
                      <app-auto-grow-cell
                        [value]="tip.nextStep"
                        [ariaLabel]="'Modifica appunto riga ' + (idx + 1)"
                        [textClass]="tip.done ? 'line-through text-[#5F6368]' : 'text-[#202124]'"
                        [maxLength]="500"
                        [allowNewlines]="true"
                        [rowIndex]="idx"
                        colKey="memoNote"
                        (committed)="commitNote(tip, $event)"
                        (navigateVertical)="moveFocusVertical(idx, $event)"
                      />
                    </td>

                    <td class="py-2.5 px-2 text-center align-middle">
                      <button
                        type="button"
                        (click)="store.deleteTip(tip.id)"
                        [attr.aria-label]="'Elimina memo: ' + tip.nextStep"
                        class="p-1.5 rounded-md text-[#5F6368] hover:text-[#D93025] hover:bg-[#FCE8E6]/60 transition-colors cursor-pointer"
                      >
                        <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">delete_outline</mat-icon>
                      </button>
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
export class TipsView {
  protected readonly store = inject(WorkspaceStore);
  protected readonly formError = signal<string | null>(null);
  protected readonly draftNoteMirror = signal<string>('');
  private readonly tableWrap = viewChild<ElementRef<HTMLDivElement>>('tableWrap');

  protected readonly openCount = computed(() => this.store.tips().filter((t) => !t.done).length);

  protected readonly tipForm = new FormGroup({
    goalId: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
    nextStep: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected onDraftKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey && !event.altKey) {
      event.preventDefault();
      void this.submitTip();
    }
  }

  protected async submitTip(): Promise<void> {
    this.formError.set(null);
    const val = this.tipForm.getRawValue();
    if (!val.goalId) {
      this.formError.set('Seleziona prima un’attività dal menù a tendina.');
      return;
    }
    if (!val.nextStep.trim()) {
      this.formError.set('Inserisci il prossimo passo da annotare.');
      return;
    }
    const ok = await this.store.addTip(val);
    if (ok) {
      this.tipForm.patchValue({ nextStep: '' });
      this.draftNoteMirror.set('');
    }
  }

  protected onGoalChange(tip: TipNote, event: Event): void {
    const goalId = (event.target as HTMLSelectElement).value;
    if (goalId && goalId !== tip.goalId) {
      void this.store.updateTip(tip.id, { goalId });
    }
  }

  protected commitNote(tip: TipNote, nextStep: string): void {
    void this.store.updateTip(tip.id, { nextStep });
  }

  protected moveFocusVertical(fromRow: number, delta: -1 | 1): void {
    const container = this.tableWrap()?.nativeElement;
    if (!container) return;
    const targetRow = fromRow + delta;
    if (targetRow < 0) return;
    const target = container.querySelector<HTMLElement>(
      `[data-cell-row="${targetRow}"][data-cell-col="memoNote"]`,
    );
    if (target) {
      target.focus();
    }
  }
}
