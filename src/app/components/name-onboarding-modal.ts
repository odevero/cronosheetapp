import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import {
  DISPLAY_NAME_LIMITS,
  normalizeDisplayName,
} from '../../core/domain/services/profile-display';
import { WorkspaceStore } from '../../core/main/workspace-store';

@Component({
  selector: 'app-name-onboarding-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    @if (store.requiresNameOnboarding()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="fixed inset-0 bg-[#202124]/45" aria-hidden="true"></div>

        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="onboarding-name-title"
          class="relative z-10 w-full max-w-md rounded-2xl bg-[#FFFFFF] border border-[#DADCE0] shadow-xl p-6 sm:p-7 space-y-5"
        >
          <div class="space-y-2">
            <div class="w-10 h-10 rounded-xl bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center">
              <mat-icon class="!text-[22px] !w-[22px] !h-[22px]" aria-hidden="true">badge</mat-icon>
            </div>
            <h2
              id="onboarding-name-title"
              class="font-display text-xl font-bold text-[#202124]"
            >
              Come vuoi chiamare il tuo spazio?
            </h2>
            <p class="text-sm text-[#5F6368] leading-relaxed">
              Inserisci il tuo nome per dare un tocco personale alla schermata principale. Potrai
              cambiarlo in qualsiasi momento in <em>Sicurezza &amp; 2FA</em>.
            </p>
          </div>

          <!-- Live Showcase Title Preview -->
          <div class="rounded-xl bg-[#F8F9FA] border border-[#E8EAED] px-4 py-3.5 flex items-center justify-center gap-2.5">
            <span
              class="w-7 h-7 rounded-lg bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center shrink-0"
              aria-hidden="true"
            >
              <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">timer</mat-icon>
            </span>
            <span class="font-display text-lg font-bold tracking-tight text-[#202124] truncate">
              {{ previewTitle() }}
            </span>
          </div>

          <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="space-y-4">
            <div class="space-y-1.5">
              <label for="onboarding-display-name" class="block text-xs font-semibold text-[#3C4043]">
                Il tuo nome <span class="text-[#C5221F]">*</span>
              </label>
              <input
                id="onboarding-display-name"
                type="text"
                formControlName="displayName"
                autocomplete="given-name"
                [attr.maxlength]="limits.max"
                placeholder="Es. Orso"
                class="w-full px-3.5 py-2.5 rounded-lg border border-[#DADCE0] bg-white text-sm text-[#202124] placeholder:text-[#80868B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:border-[#1A73E8]"
              />
              @if (errorMessage(); as err) {
                <p role="alert" class="text-xs text-[#C5221F]">{{ err }}</p>
              }
            </div>

            <button
              type="submit"
              [disabled]="saving()"
              class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-sm font-medium transition-colors disabled:opacity-60 cursor-pointer"
            >
              @if (saving()) {
                <mat-icon class="!text-[18px] !w-[18px] !h-[18px] animate-spin" aria-hidden="true">
                  progress_activity
                </mat-icon>
                <span>Salvataggio…</span>
              } @else {
                <mat-icon class="!text-[18px] !w-[18px] !h-[18px]" aria-hidden="true">
                  arrow_forward
                </mat-icon>
                <span>Continua</span>
              }
            </button>
          </form>
        </div>
      </div>
    }
  `,
})
export class NameOnboardingModal {
  protected readonly store = inject(WorkspaceStore);
  protected readonly limits = DISPLAY_NAME_LIMITS;
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly form = new FormGroup({
    displayName: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(DISPLAY_NAME_LIMITS.min),
        Validators.maxLength(DISPLAY_NAME_LIMITS.max),
      ],
    }),
  });

  private readonly nameInput = toSignal(this.form.controls.displayName.valueChanges, {
    initialValue: '',
  });

  protected readonly previewTitle = computed(() => {
    const clean = normalizeDisplayName(this.nameInput());
    return clean.length >= DISPLAY_NAME_LIMITS.min ? `CronoSheet di ${clean}` : 'CronoSheet di …';
  });

  protected async submit(): Promise<void> {
    this.errorMessage.set(null);
    const raw = this.form.controls.displayName.value;
    this.saving.set(true);
    try {
      const res = await this.store.updateDisplayName(raw);
      if (!res.ok) {
        this.errorMessage.set(res.error ?? 'Inserisci un nome valido.');
      }
    } finally {
      this.saving.set(false);
    }
  }
}
