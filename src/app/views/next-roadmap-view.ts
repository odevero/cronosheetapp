import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { WorkspaceStore } from '../../core/main/workspace-store';
import { AutoGrowCell } from '../components/auto-grow-cell';

@Component({
  selector: 'app-next-roadmap-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule, AutoGrowCell],
  template: `
    <div class="grid grid-cols-1 xl:grid-cols-12 gap-6">
      <!-- Left: Personal NEXT Checklist (seeded from uploaded CSV) -->
      <section class="xl:col-span-7 bg-white border border-[#DADCE0] rounded-xl overflow-hidden">
        <div class="px-5 py-4 bg-[#F8F9FA] border-b border-[#DADCE0]">
          <h2 class="font-display text-base font-bold text-[#202124]">
            Scheda NEXT — Backlog &amp; Evoluzione App
          </h2>
          <p class="text-xs text-[#5F6368] mt-0.5">
            Importata dal tuo foglio originale: traccia i miglioramenti futuri e le feature analitiche.
          </p>
        </div>

        <form [formGroup]="form" (ngSubmit)="addItem()" class="p-4 border-b border-[#E8EAED] flex items-center gap-2.5">
          <label for="next-item-input" class="sr-only">Nuova attività roadmap</label>
          <input
            id="next-item-input"
            type="text"
            formControlName="text"
            maxlength="300"
            placeholder="Aggiungi una nuova feature o miglioramento..."
            class="flex-1 px-3 py-2 rounded-lg border border-[#DADCE0] text-[15px] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
          />
          <button
            type="submit"
            [disabled]="form.invalid"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-sm font-medium disabled:opacity-50 whitespace-nowrap cursor-pointer"
          >
            <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">add</mat-icon>
            <span>Aggiungi</span>
          </button>
        </form>

        <ul class="divide-y divide-[#E8EAED]">
          @for (item of store.roadmapItems(); track item.id; let idx = $index) {
            <li class="px-4 py-2 flex items-center justify-between gap-2 hover:bg-[#F8F9FA]/70">
              <input
                type="checkbox"
                [checked]="item.done"
                (change)="store.toggleRoadmapItem(item)"
                [attr.aria-label]="'Completa voce roadmap: ' + item.text"
                class="w-4 h-4 accent-[#34A853] shrink-0 cursor-pointer"
              />
              <div class="flex-1 min-w-0">
                <app-auto-grow-cell
                  [value]="item.text"
                  [ariaLabel]="'Modifica voce roadmap ' + (idx + 1)"
                  [textClass]="item.done ? 'line-through text-[#5F6368]' : 'text-[#202124]'"
                  [maxLength]="300"
                  [rowIndex]="idx"
                  colKey="nextText"
                  (committed)="store.updateRoadmapItem(item.id, { text: $event })"
                />
              </div>
              <button
                type="button"
                (click)="store.deleteRoadmapItem(item.id)"
                [attr.aria-label]="'Elimina voce roadmap: ' + item.text"
                class="p-1 rounded-md text-[#5F6368] hover:text-[#EA4335] shrink-0 cursor-pointer"
              >
                <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">delete_outline</mat-icon>
              </button>
            </li>
          }
        </ul>
      </section>

      <!-- Right: Clean Architecture Blueprint (for GitHub & CV showcase) -->
      <section class="xl:col-span-5 bg-white border border-[#DADCE0] rounded-xl overflow-hidden">
        <div class="px-5 py-4 bg-[#F8F9FA] border-b border-[#DADCE0]">
          <h2 class="font-display text-base font-bold text-[#202124]">
            Clean Architecture del Progetto
          </h2>
          <p class="text-xs text-[#5F6368] mt-0.5">
            Separazione netta dei layer in <span class="font-mono">src/core/</span> per manutenibilità, testabilità e portfolio GitHub.
          </p>
        </div>

        <div class="divide-y divide-[#E8EAED] text-sm">
          <div class="px-5 py-3.5">
            <p class="font-mono text-xs font-semibold text-[#174EA6]">01. src/core/domain/</p>
            <p class="text-xs text-[#5F6368] mt-1">
              Entità pure, algoritmo calendario esatto (anni bisestili e fine mese), generatore messaggi IT/EN, scanner ricorrenze, palette Google e TOTP RFC 6238. Zero dipendenze esterne.
            </p>
          </div>
          <div class="px-5 py-3.5">
            <p class="font-mono text-xs font-semibold text-[#A50E0E]">02. src/core/usecases/</p>
            <p class="text-xs text-[#5F6368] mt-1">
              Contratti (Ports) dei repository, validazione payload sincronizzata con lo schema, FilterSort non distruttivo, export CSV sicuro e flusso enrollment/verifica 2FA.
            </p>
          </div>
          <div class="px-5 py-3.5">
            <p class="font-mono text-xs font-semibold text-[#9A5B00]">03. src/core/tests/</p>
            <p class="text-xs text-[#5F6368] mt-1">
              Suite unitaria deterministica (<span class="font-mono">node:test</span>) per 28/29 febbraio, 31 gennaio, scenari date, ricorrenze esatte e vettori RFC 6238.
            </p>
          </div>
          <div class="px-5 py-3.5">
            <p class="font-mono text-xs font-semibold text-[#137333]">04. src/core/adapters/</p>
            <p class="text-xs text-[#5F6368] mt-1">
              Implementazioni concrete per Cloud Firestore (con gestione errori strutturata e regole per UID) + LocalDemoStore intercambiabile senza toccare la business logic.
            </p>
          </div>
          <div class="px-5 py-3.5">
            <p class="font-mono text-xs font-semibold text-[#202124]">05. src/core/main/</p>
            <p class="text-xs text-[#5F6368] mt-1">
              Composition Root (<span class="font-mono">WorkspaceStore</span>) che collega dominio, use cases e adapter ai segnali reattivi di Angular 21 Zoneless.
            </p>
          </div>
        </div>
      </section>
    </div>
  `,
})
export class NextRoadmapView {
  protected readonly store = inject(WorkspaceStore);

  protected readonly form = new FormGroup({
    text: new FormControl('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected async addItem(): Promise<void> {
    if (this.form.invalid) return;
    const ok = await this.store.addRoadmapItem(this.form.getRawValue().text);
    if (ok) {
      this.form.reset({ text: '' });
    }
  }
}
