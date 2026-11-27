import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import {
  FEEDBACK_CATEGORIES,
  FEEDBACK_LIMITS,
  FeedbackCategory,
  FormattedGitHubIssue,
} from '../../core/domain/services/feedback-issue';
import { TranslationKey } from '../../core/i18n/it';
import { WorkspaceStore } from '../../core/main/workspace-store';
import { I18nService } from '../services/i18n';

interface FeedbackApiResponse {
  readonly ok: boolean;
  readonly code?: string;
  readonly message?: string;
  readonly issueNumber?: number | null;
  readonly issueUrl?: string | null;
  readonly formattedIssue?: FormattedGitHubIssue;
}

const CATEGORY_LABEL_KEYS: Record<FeedbackCategory, TranslationKey> = {
  bug: 'feedback.catBug',
  feature: 'feedback.catFeature',
  improvement: 'feedback.catImprovement',
  question: 'feedback.catQuestion',
};

@Component({
  selector: 'app-feedback-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule],
  host: {
    '(window:keydown.escape)': 'onEscapeKey()',
  },
  template: `
    @if (store.feedbackModalOpen()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
          type="button"
          (click)="close()"
          [attr.aria-label]="i18n.t('feedback.closeAria')"
          class="fixed inset-0 bg-[#202124]/45 cursor-default"
        ></button>

        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-modal-title"
          class="relative z-10 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl bg-[#FFFFFF] border border-[#DADCE0] shadow-xl p-6 sm:p-7 space-y-5"
        >
          <!-- Header -->
          <div class="flex items-start justify-between gap-4">
            <div class="space-y-1">
              <div class="flex items-center gap-2">
                <span
                  class="w-7 h-7 rounded-lg bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center shrink-0"
                  aria-hidden="true"
                >
                  <mat-icon class="!text-[17px] !w-[17px] !h-[17px]">feedback</mat-icon>
                </span>
                <h2
                  id="feedback-modal-title"
                  class="font-display text-lg font-bold text-[#202124]"
                >
                  {{ i18n.t('feedback.title') }}
                </h2>
              </div>
              <p class="text-[13px] text-[#5F6368] leading-relaxed">
                {{ i18n.t('feedback.subtitle') }}
              </p>
            </div>

            <button
              type="button"
              (click)="close()"
              [attr.aria-label]="i18n.t('feedback.closeAria')"
              class="p-1.5 rounded-lg text-[#5F6368] hover:bg-[#F1F3F4] transition-colors cursor-pointer shrink-0"
            >
              <mat-icon class="!text-[20px] !w-[20px] !h-[20px]">close</mat-icon>
            </button>
          </div>

          <!-- Success state -->
          @if (createdIssue(); as created) {
            <div class="rounded-xl border border-[#A8DAB5] bg-[#E6F4EA] p-4 space-y-2.5">
              <div class="flex items-center gap-2 text-[#137333] font-semibold text-sm">
                <mat-icon class="!text-[20px] !w-[20px] !h-[20px]" aria-hidden="true">
                  check_circle
                </mat-icon>
                <span>
                  {{ i18n.t('feedback.successTitle') }}
                  @if (created.issueNumber !== null) {
                    (#{{ created.issueNumber }})
                  }
                </span>
              </div>
              <p class="text-[13px] text-[#1E4620] leading-relaxed">
                {{ i18n.t('feedback.successBody') }}
              </p>
              @if (created.issueUrl) {
                <a
                  [href]="created.issueUrl"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#137333] hover:underline"
                >
                  <span>{{ i18n.t('feedback.openIssue') }}</span>
                  <mat-icon class="!text-[15px] !w-[15px] !h-[15px]" aria-hidden="true">
                    open_in_new
                  </mat-icon>
                </a>
              }
            </div>

            <div class="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                (click)="resetForAnother()"
                class="px-4 py-2 rounded-lg border border-[#DADCE0] bg-white hover:bg-[#F8F9FA] text-[#3C4043] text-sm font-medium transition-colors cursor-pointer"
              >
                {{ i18n.t('feedback.sendAnother') }}
              </button>
              <button
                type="button"
                (click)="close()"
                class="px-4 py-2 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-sm font-medium transition-colors cursor-pointer"
              >
                {{ i18n.t('common.close') }}
              </button>
            </div>
          } @else {
            <!-- Feedback Reactive Form -->
            <form [formGroup]="form" (ngSubmit)="submit()" novalidate class="space-y-4">
              <!-- Category selector -->
              <fieldset class="space-y-1.5">
                <legend class="text-xs font-semibold text-[#3C4043]">
                  {{ i18n.t('feedback.categoryLegend') }}
                </legend>
                <div class="grid grid-cols-2 gap-2">
                  @for (cat of categories; track cat.id) {
                    <button
                      type="button"
                      (click)="selectCategory(cat.id)"
                      [attr.aria-pressed]="selectedCategory() === cat.id"
                      [class]="
                        selectedCategory() === cat.id
                          ? 'px-3 py-2 rounded-lg border border-[#1A73E8] bg-[#E8F0FE] text-[#174EA6] text-xs font-semibold text-left transition-colors cursor-pointer'
                          : 'px-3 py-2 rounded-lg border border-[#DADCE0] bg-[#FFFFFF] hover:bg-[#F8F9FA] text-[#3C4043] text-xs font-medium text-left transition-colors cursor-pointer'
                      "
                    >
                      {{ i18n.t(categoryLabelKey(cat.id)) }}
                    </button>
                  }
                </div>
              </fieldset>

              <!-- Title -->
              <div class="space-y-1">
                <div class="flex items-baseline justify-between gap-2">
                  <label for="feedback-title" class="text-xs font-semibold text-[#3C4043]">
                    {{ i18n.t('feedback.titleLabel') }} <span class="text-[#C5221F]">*</span>
                  </label>
                  <span class="text-[11px] text-[#80868B] tabular-nums">
                    {{ titleLength() }}/{{ limits.titleMax }}
                  </span>
                </div>
                <input
                  id="feedback-title"
                  type="text"
                  formControlName="title"
                  [attr.maxlength]="limits.titleMax"
                  [placeholder]="i18n.t('feedback.titlePlaceholder')"
                  class="w-full px-3 py-2 rounded-lg border border-[#DADCE0] bg-[#FFFFFF] text-sm text-[#202124] placeholder:text-[#80868B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:border-[#1A73E8]"
                />
                @if (showTitleError()) {
                  <p class="text-xs text-[#C5221F]" role="alert">
                    {{ i18n.t('feedback.titleError', { min: limits.titleMin, max: limits.titleMax }) }}
                  </p>
                }
              </div>

              <!-- Description -->
              <div class="space-y-1">
                <div class="flex items-baseline justify-between gap-2">
                  <label for="feedback-description" class="text-xs font-semibold text-[#3C4043]">
                    {{ i18n.t('feedback.descriptionLabel') }} <span class="text-[#C5221F]">*</span>
                  </label>
                  <span class="text-[11px] text-[#80868B] tabular-nums">
                    {{ descriptionLength() }}/{{ limits.descriptionMax }}
                  </span>
                </div>
                <textarea
                  id="feedback-description"
                  rows="4"
                  formControlName="description"
                  [attr.maxlength]="limits.descriptionMax"
                  [placeholder]="i18n.t('feedback.descriptionPlaceholder')"
                  class="w-full px-3 py-2 rounded-lg border border-[#DADCE0] bg-[#FFFFFF] text-sm text-[#202124] placeholder:text-[#80868B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:border-[#1A73E8] resize-y"
                ></textarea>
                @if (showDescriptionError()) {
                  <p class="text-xs text-[#C5221F]" role="alert">
                    {{ i18n.t('feedback.descriptionError', { min: limits.descriptionMin }) }}
                  </p>
                }
              </div>

              <!-- Optional contact -->
              <div class="space-y-1">
                <label for="feedback-contact" class="text-xs font-semibold text-[#3C4043]">
                  {{ i18n.t('feedback.contactLabel') }}
                  <span class="font-normal text-[#80868B]">{{ i18n.t('feedback.contactHint') }}</span>
                </label>
                <input
                  id="feedback-contact"
                  type="text"
                  formControlName="contact"
                  [attr.maxlength]="limits.contactMax"
                  [placeholder]="i18n.t('feedback.contactPlaceholder')"
                  class="w-full px-3 py-2 rounded-lg border border-[#DADCE0] bg-[#FFFFFF] text-sm text-[#202124] placeholder:text-[#80868B] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:border-[#1A73E8]"
                />
                <p class="text-[11px] text-[#80868B]">
                  {{ i18n.t('feedback.publicNotice') }}
                </p>
              </div>

              <!-- Hidden anti-spam honeypot field -->
              <div class="sr-only" aria-hidden="true">
                <label for="feedback-website">{{ i18n.t('feedback.honeypotLabel') }}</label>
                <input
                  id="feedback-website"
                  type="text"
                  formControlName="website"
                  tabindex="-1"
                  autocomplete="off"
                />
              </div>

              <!-- Error / Fallback notice -->
              @if (errorMessage(); as err) {
                <div
                  role="alert"
                  class="rounded-xl border border-[#F6AEA9] bg-[#FCE8E6] p-3.5 text-[13px] text-[#A50E0E] space-y-2.5"
                >
                  <p class="leading-relaxed">{{ err }}</p>

                  @if (fallbackIssue(); as draft) {
                    <div class="flex flex-wrap items-center gap-2.5 pt-0.5">
                      <button
                        type="button"
                        (click)="copyFallbackDraft(draft)"
                        class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#FFFFFF] border border-[#F6AEA9] text-[#A50E0E] hover:bg-[#FEF7F6] text-xs font-semibold transition-colors cursor-pointer"
                      >
                        <mat-icon class="!text-[15px] !w-[15px] !h-[15px]" aria-hidden="true">
                          {{ copiedFallback() ? 'check' : 'content_copy' }}
                        </mat-icon>
                        <span>
                          {{ copiedFallback() ? i18n.t('feedback.copiedDraft') : i18n.t('feedback.copyDraft') }}
                        </span>
                      </button>

                      <a
                        href="https://github.com/odevero"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="inline-flex items-center gap-1 text-xs font-semibold text-[#A50E0E] hover:underline"
                      >
                        <span>{{ i18n.t('feedback.openGithub') }}</span>
                        <mat-icon class="!text-[14px] !w-[14px] !h-[14px]" aria-hidden="true">
                          open_in_new
                        </mat-icon>
                      </a>
                    </div>
                  }
                </div>
              }

              <!-- Footer Actions -->
              <div class="pt-2 flex items-center justify-end gap-3 border-t border-[#F1F3F4]">
                <button
                  type="button"
                  (click)="close()"
                  [disabled]="submitting()"
                  class="px-4 py-2 rounded-lg border border-[#DADCE0] bg-white hover:bg-[#F8F9FA] text-[#3C4043] text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                >
                  {{ i18n.t('common.cancel') }}
                </button>
                <button
                  type="submit"
                  [disabled]="submitting()"
                  class="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-sm font-medium transition-colors cursor-pointer disabled:opacity-60"
                >
                  @if (submitting()) {
                    <mat-icon class="!text-[17px] !w-[17px] !h-[17px] animate-spin" aria-hidden="true">
                      progress_activity
                    </mat-icon>
                    <span>{{ i18n.t('feedback.submitting') }}</span>
                  } @else {
                    <mat-icon class="!text-[17px] !w-[17px] !h-[17px]" aria-hidden="true">
                      send
                    </mat-icon>
                    <span>{{ i18n.t('feedback.submit') }}</span>
                  }
                </button>
              </div>
            </form>
          }
        </div>
      </div>
    }
  `,
})
export class FeedbackModal {
  protected readonly store = inject(WorkspaceStore);
  protected readonly i18n = inject(I18nService);
  protected readonly categories = FEEDBACK_CATEGORIES;
  protected readonly limits = FEEDBACK_LIMITS;

  protected readonly form = new FormGroup({
    category: new FormControl<FeedbackCategory>('feature', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    title: new FormControl<string>('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(FEEDBACK_LIMITS.titleMin),
        Validators.maxLength(FEEDBACK_LIMITS.titleMax),
      ],
    }),
    description: new FormControl<string>('', {
      nonNullable: true,
      validators: [
        Validators.required,
        Validators.minLength(FEEDBACK_LIMITS.descriptionMin),
        Validators.maxLength(FEEDBACK_LIMITS.descriptionMax),
      ],
    }),
    contact: new FormControl<string>('', {
      nonNullable: true,
      validators: [Validators.maxLength(FEEDBACK_LIMITS.contactMax)],
    }),
    website: new FormControl<string>('', { nonNullable: true }),
  });

  protected readonly selectedCategory = signal<FeedbackCategory>('feature');
  protected readonly attemptedSubmit = signal<boolean>(false);
  protected readonly submitting = signal<boolean>(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly fallbackIssue = signal<FormattedGitHubIssue | null>(null);
  protected readonly copiedFallback = signal<boolean>(false);
  protected readonly createdIssue = signal<{
    readonly issueNumber: number | null;
    readonly issueUrl: string | null;
  } | null>(null);

  private readonly titleValue = toSignal(this.form.controls.title.valueChanges, {
    initialValue: '',
  });
  private readonly descriptionValue = toSignal(this.form.controls.description.valueChanges, {
    initialValue: '',
  });

  protected readonly titleLength = computed(() => this.titleValue().trim().length);
  protected readonly descriptionLength = computed(() => this.descriptionValue().trim().length);

  protected categoryLabelKey(category: FeedbackCategory): TranslationKey {
    return CATEGORY_LABEL_KEYS[category];
  }

  protected showTitleError(): boolean {
    const ctrl = this.form.controls.title;
    const len = ctrl.value.trim().length;
    const invalid = len < FEEDBACK_LIMITS.titleMin || len > FEEDBACK_LIMITS.titleMax;
    return invalid && (this.attemptedSubmit() || ctrl.touched);
  }

  protected showDescriptionError(): boolean {
    const ctrl = this.form.controls.description;
    const len = ctrl.value.trim().length;
    const invalid = len < FEEDBACK_LIMITS.descriptionMin || len > FEEDBACK_LIMITS.descriptionMax;
    return invalid && (this.attemptedSubmit() || ctrl.touched);
  }

  protected selectCategory(category: FeedbackCategory): void {
    this.selectedCategory.set(category);
    this.form.controls.category.setValue(category);
  }

  protected onEscapeKey(): void {
    if (this.store.feedbackModalOpen() && !this.submitting()) {
      this.close();
    }
  }

  protected close(): void {
    this.store.closeFeedbackModal();
    this.errorMessage.set(null);
    this.fallbackIssue.set(null);
    this.copiedFallback.set(false);
    this.attemptedSubmit.set(false);
    if (this.createdIssue()) {
      this.resetForAnother();
    }
  }

  protected resetForAnother(): void {
    this.form.reset({
      category: 'feature',
      title: '',
      description: '',
      contact: '',
      website: '',
    });
    this.selectedCategory.set('feature');
    this.attemptedSubmit.set(false);
    this.errorMessage.set(null);
    this.fallbackIssue.set(null);
    this.copiedFallback.set(false);
    this.createdIssue.set(null);
  }

  protected async submit(): Promise<void> {
    this.attemptedSubmit.set(true);
    this.errorMessage.set(null);
    this.fallbackIssue.set(null);
    this.copiedFallback.set(false);

    const title = this.form.controls.title.value.trim();
    const description = this.form.controls.description.value.trim();
    const contact = this.form.controls.contact.value.trim();
    const website = this.form.controls.website.value;
    const category = this.form.controls.category.value;

    if (
      title.length < FEEDBACK_LIMITS.titleMin ||
      title.length > FEEDBACK_LIMITS.titleMax ||
      description.length < FEEDBACK_LIMITS.descriptionMin ||
      description.length > FEEDBACK_LIMITS.descriptionMax ||
      contact.length > FEEDBACK_LIMITS.contactMax
    ) {
      return;
    }

    this.submitting.set(true);
    try {
      const response = await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'CronoSheet',
        },
        body: JSON.stringify({
          category,
          title,
          description,
          contact,
          surface: this.store.feedbackSurface(),
          website,
        }),
      });

      const payload = (await response.json()) as FeedbackApiResponse;
      if (response.ok && payload.ok) {
        this.createdIssue.set({
          issueNumber: payload.issueNumber ?? null,
          issueUrl: payload.issueUrl ?? null,
        });
        return;
      }

      this.errorMessage.set(payload.message || this.i18n.t('feedback.errorGeneric'));
      if (payload.formattedIssue) {
        this.fallbackIssue.set(payload.formattedIssue);
      }
    } catch {
      this.errorMessage.set(this.i18n.t('feedback.errorNetwork'));
    } finally {
      this.submitting.set(false);
    }
  }

  protected async copyFallbackDraft(draft: FormattedGitHubIssue): Promise<void> {
    const markdown = `# ${draft.title}\n\n${draft.body}`;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(markdown);
      } catch {
        // Clipboard unavailable in restricted contexts
      }
    }
    this.copiedFallback.set(true);
    window.setTimeout(() => this.copiedFallback.set(false), 2000);
  }
}
