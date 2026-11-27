import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import {
  addCalendarDays,
  formatDateShort,
  getTodayIsoLocal,
} from '../../core/domain/services/calendar-duration';
import { computeGoalMetrics } from '../../core/domain/services/message-generator';
import { TranslationKey } from '../../core/i18n/it';
import { WorkspaceStore } from '../../core/main/workspace-store';
import { LanguageSwitcher } from '../components/language-switcher';
import { I18nService } from '../services/i18n';

type LegalTopic = 'privacy' | 'terms' | 'license' | 'contact' | null;

interface PreviewPreset {
  readonly id: string;
  readonly labelKey: TranslationKey;
  readonly title: string;
  readonly startOffsetDays: number;
  readonly endOffsetDays: number | null;
  readonly accentColor: string;
}

@Component({
  selector: 'app-landing-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, LanguageSwitcher],
  host: {
    '(window:keydown.escape)': 'closeLegalModal()',
  },
  template: `
    <div class="min-h-screen bg-[#FFFFFF] text-[#202124] flex flex-col">
      <!-- Top Bar: Logo (left -> Landing) + single "App" nav item (right -> App) -->
      <header class="sticky top-0 z-30 bg-[#FFFFFF]/95 backdrop-blur-sm border-b border-[#E8EAED]">
        <div class="max-w-6xl mx-auto h-16 px-6 sm:px-10 flex items-center justify-between gap-8">
          <button
            type="button"
            (click)="scrollToTop()"
            [attr.aria-label]="i18n.t('landing.scrollTopAria')"
            class="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1A73E8] rounded-lg"
          >
            <img
              src="/icons/pwa-192x192.png"
              alt=""
              referrerpolicy="no-referrer"
              class="w-8 h-8 rounded-lg shrink-0"
            />
            <span class="font-display font-bold text-lg tracking-tight text-[#202124]">
              CronoSheet
            </span>
          </button>

          <nav [attr.aria-label]="i18n.t('landing.navAria')" class="flex items-center gap-3 sm:gap-4 shrink-0">
            <app-language-switcher />
            <button
              type="button"
              (click)="openApp()"
              class="inline-flex items-center gap-1.5 px-3 py-2 text-[15px] font-medium text-[#202124] hover:text-[#1A73E8] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1A73E8] rounded-md"
            >
              <span>{{ i18n.t('landing.navApp') }}</span>
              <mat-icon class="!text-[17px] !w-[17px] !h-[17px] text-[#5F6368]" aria-hidden="true">
                arrow_forward
              </mat-icon>
            </button>
          </nav>
        </div>
      </header>

      <main class="flex-1">
        <!-- Section 1: Hero + Live Interactive Counter Preview -->
        <section class="max-w-6xl mx-auto px-6 sm:px-10 pt-14 sm:pt-20 pb-16 sm:pb-24">
          <div class="max-w-3xl">
            <p class="text-[13px] font-medium text-[#5F6368] tracking-normal">
              {{ i18n.t('landing.eyebrow') }}
            </p>

            <h1
              class="mt-4 font-display font-bold tracking-tight text-[#202124] leading-[1.1]"
              style="font-size: clamp(2.25rem, 4.4vw, 3.6rem); text-wrap: balance;"
              data-testid="landing-hero-title"
            >
              {{ i18n.t('landing.heroTitle') }}
            </h1>

            <p class="mt-5 text-base sm:text-lg text-[#5F6368] leading-relaxed max-w-2xl">
              {{ i18n.t('landing.heroSubtitle') }}
            </p>

            <div class="mt-8 flex flex-wrap items-center gap-5">
              <button
                type="button"
                (click)="openApp()"
                class="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-[15px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A73E8]"
              >
                <mat-icon class="!text-[19px] !w-[19px] !h-[19px]" aria-hidden="true">login</mat-icon>
                <span>{{ isSignedIn() ? i18n.t('landing.ctaReturnApp') : i18n.t('landing.ctaOpenApp') }}</span>
              </button>

              <button
                type="button"
                (click)="enterDemo()"
                class="inline-flex items-center gap-1.5 px-2 py-2 text-[15px] font-medium text-[#3C4043] hover:text-[#1A73E8] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A73E8] rounded-md"
              >
                <span>{{ i18n.t('landing.ctaDemo') }}</span>
                <mat-icon class="!text-[17px] !w-[17px] !h-[17px]" aria-hidden="true">
                  chevron_right
                </mat-icon>
              </button>
            </div>
          </div>

          <!-- Interactive Live Product Frame (Real Domain Engine) -->
          <div class="mt-14 sm:mt-16 border border-[#DADCE0] rounded-2xl bg-[#FFFFFF] overflow-hidden">
            <div class="px-5 sm:px-7 py-4 bg-[#F8F9FA] border-b border-[#E8EAED] flex flex-wrap items-center justify-between gap-4">
              <div class="flex items-center gap-2 text-[13px] text-[#5F6368]">
                <span class="font-medium text-[#202124]">{{ i18n.t('landing.previewLabel') }}</span>
                <span class="text-[#BDC1C6]" aria-hidden="true">·</span>
                <span>{{ i18n.t('landing.previewHint') }}</span>
              </div>

              <div
                class="flex items-center gap-1 p-1 bg-[#FFFFFF] border border-[#E8EAED] rounded-lg"
                role="tablist"
                [attr.aria-label]="i18n.t('landing.presetsAria')"
              >
                @for (preset of presets; track preset.id) {
                  <button
                    type="button"
                    role="tab"
                    [attr.aria-selected]="selectedPresetId() === preset.id"
                    (click)="selectPreset(preset.id)"
                    [class]="
                      selectedPresetId() === preset.id
                        ? 'px-3 py-1.5 text-xs font-semibold rounded-md bg-[#E8F0FE] text-[#174EA6] transition-colors whitespace-nowrap shrink-0 cursor-pointer'
                        : 'px-3 py-1.5 text-xs font-medium rounded-md text-[#5F6368] hover:text-[#202124] transition-colors whitespace-nowrap shrink-0 cursor-pointer'
                    "
                  >
                    {{ i18n.t(preset.labelKey) }}
                  </button>
                }
              </div>
            </div>

            <div class="px-5 sm:px-7 py-6">
              <div class="overflow-x-auto">
                <table class="w-full border-collapse text-left min-w-[680px]">
                  <thead>
                    <tr class="border-b border-[#E8EAED] text-[12px] font-medium text-[#5F6368]">
                      <th scope="col" class="pb-3 pr-5">{{ i18n.t('showcase.colActivity') }}</th>
                      <th scope="col" class="pb-3 px-3 whitespace-nowrap">{{ i18n.t('showcase.colStart') }}</th>
                      <th scope="col" class="pb-3 px-3 whitespace-nowrap">{{ i18n.t('showcase.colEnd') }}</th>
                      <th scope="col" class="pb-3 px-3 text-right whitespace-nowrap">{{ i18n.t('showcase.colDays') }}</th>
                      <th scope="col" class="pb-3 px-2 text-right whitespace-nowrap" [title]="i18n.t('showcase.colYTitle')">{{ i18n.t('showcase.colY') }}</th>
                      <th scope="col" class="pb-3 px-2 text-right whitespace-nowrap" [title]="i18n.t('showcase.colMTitle')">{{ i18n.t('showcase.colM') }}</th>
                      <th scope="col" class="pb-3 px-2 text-right whitespace-nowrap" [title]="i18n.t('showcase.colWTitle')">{{ i18n.t('showcase.colW') }}</th>
                      <th scope="col" class="pb-3 px-2 text-right whitespace-nowrap" [title]="i18n.t('showcase.colDTitle')">{{ i18n.t('showcase.colD') }}</th>
                      <th scope="col" class="pb-3 pl-5">{{ i18n.t('showcase.colMessages') }}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr class="align-top text-[15px]">
                      <td class="pt-4 pr-5 font-semibold" [style.color]="activePreset().accentColor">
                        {{ activePreset().title }}
                      </td>
                      <td class="pt-3.5 px-3 whitespace-nowrap">
                        <label for="landing-preview-date" class="sr-only">{{ i18n.t('landing.previewDateAria') }}</label>
                        <input
                          id="landing-preview-date"
                          type="date"
                          [value]="previewStartDate()"
                          (change)="onPreviewDateChange($event)"
                          class="px-2 py-1 rounded-md border border-[#E8EAED] bg-[#F8F9FA] text-[13px] text-[#3C4043] tabular-nums focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
                        />
                      </td>
                      <td class="pt-4 px-3 text-[#5F6368] tabular-nums whitespace-nowrap text-[14px]">
                        {{ previewEndDate() ? formatShort(previewEndDate()) : '—' }}
                      </td>
                      <td class="pt-4 px-3 text-right font-semibold text-[#202124] tabular-nums whitespace-nowrap">
                        {{ previewMetrics().primaryDays ?? '—' }}
                      </td>
                      <td class="pt-4 px-2 text-right text-[#3C4043] tabular-nums whitespace-nowrap">
                        {{ previewMetrics().breakdown?.years ?? '—' }}
                      </td>
                      <td class="pt-4 px-2 text-right text-[#3C4043] tabular-nums whitespace-nowrap">
                        {{ previewMetrics().breakdown?.months ?? '—' }}
                      </td>
                      <td class="pt-4 px-2 text-right text-[#3C4043] tabular-nums whitespace-nowrap">
                        {{ previewMetrics().breakdown?.weeks ?? '—' }}
                      </td>
                      <td class="pt-4 px-2 text-right text-[#3C4043] tabular-nums whitespace-nowrap">
                        {{ previewMetrics().breakdown?.days ?? '—' }}
                      </td>
                      <td class="pt-3.5 pl-5">
                        <div class="flex flex-col gap-1.5">
                          <button
                            type="button"
                            (click)="copyPreviewMessage(previewMetrics().shareDaysMessage, 'days')"
                            class="group inline-flex items-center justify-between gap-2 text-left text-[14px] text-[#202124] hover:text-[#1A73E8] transition-colors cursor-pointer"
                          >
                            <span>{{ previewMetrics().shareDaysMessage }}</span>
                            <mat-icon
                              class="!text-[15px] !w-[15px] !h-[15px] shrink-0 text-[#80868B] group-hover:text-[#1A73E8]"
                              aria-hidden="true"
                            >
                              {{ copiedKey() === 'days' ? 'check' : 'content_copy' }}
                            </mat-icon>
                          </button>

                          <button
                            type="button"
                            (click)="copyPreviewMessage(previewMetrics().shareYmwMessage, 'ymw')"
                            class="group inline-flex items-center justify-between gap-2 text-left text-[14px] text-[#5F6368] hover:text-[#1A73E8] transition-colors cursor-pointer"
                          >
                            <span>{{ previewMetrics().shareYmwMessage }}</span>
                            <mat-icon
                              class="!text-[15px] !w-[15px] !h-[15px] shrink-0 text-[#80868B] group-hover:text-[#1A73E8]"
                              aria-hidden="true"
                            >
                              {{ copiedKey() === 'ymw' ? 'check' : 'content_copy' }}
                            </mat-icon>
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <!-- Section 2: Come funziona (Editorial Numbered Capabilities) -->
        <section id="come-funziona" class="border-t border-[#E8EAED]">
          <div class="max-w-6xl mx-auto px-6 sm:px-10 py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
            <div class="lg:col-span-4 space-y-3">
              <h2
                class="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#202124] leading-snug"
                style="text-wrap: balance;"
              >
                {{ i18n.t('landing.howTitle') }}
              </h2>
              <p class="text-[15px] text-[#5F6368] leading-relaxed">
                {{ i18n.t('landing.howSubtitle') }}
              </p>
            </div>

            <div class="lg:col-span-8 divide-y divide-[#E8EAED] border-t border-b border-[#E8EAED]">
              <article class="py-6 sm:py-7 grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-6">
                <div class="sm:col-span-4">
                  <h3 class="font-display text-base font-semibold text-[#202124]">
                    {{ i18n.t('landing.step1Title') }}
                  </h3>
                </div>
                <div class="sm:col-span-8">
                  <p class="text-[15px] text-[#5F6368] leading-relaxed">
                    {{ i18n.t('landing.step1Body') }}
                  </p>
                </div>
              </article>

              <article class="py-6 sm:py-7 grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-6">
                <div class="sm:col-span-4">
                  <h3 class="font-display text-base font-semibold text-[#202124]">
                    {{ i18n.t('landing.step2Title') }}
                  </h3>
                </div>
                <div class="sm:col-span-8">
                  <p class="text-[15px] text-[#5F6368] leading-relaxed">
                    {{ i18n.t('landing.step2Body') }}
                  </p>
                </div>
              </article>

              <article class="py-6 sm:py-7 grid grid-cols-1 sm:grid-cols-12 gap-3 sm:gap-6">
                <div class="sm:col-span-4">
                  <h3 class="font-display text-base font-semibold text-[#202124]">
                    {{ i18n.t('landing.step3Title') }}
                  </h3>
                </div>
                <div class="sm:col-span-8">
                  <p class="text-[15px] text-[#5F6368] leading-relaxed">
                    {{ i18n.t('landing.step3Body') }}
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <!-- Section 3: Privacy, Security & Web-to-Mobile Evolution -->
        <section class="border-t border-[#E8EAED]">
          <div class="max-w-6xl mx-auto px-6 sm:px-10 py-16 sm:py-24 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
            <div class="lg:col-span-6">
              <div class="h-full min-h-[260px] rounded-2xl overflow-hidden border border-[#E8EAED] bg-[#F8F9FA]">
                <img
                  src="/images/cronosheet_minimal_workspace_1795707561751.jpg"
                  [alt]="i18n.t('landing.workspaceImageAlt')"
                  referrerpolicy="no-referrer"
                  class="w-full h-full object-cover aspect-[16/10] lg:aspect-auto"
                />
              </div>
            </div>

            <div class="lg:col-span-6 flex flex-col justify-center space-y-6">
              <div class="space-y-3">
                <p class="text-[13px] font-medium text-[#1A73E8]">
                  {{ i18n.t('landing.privacyEyebrow') }}
                </p>
                <h2
                  class="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#202124] leading-snug"
                  style="text-wrap: balance;"
                >
                  {{ i18n.t('landing.privacyTitle') }}
                </h2>
                <p class="text-[15px] text-[#5F6368] leading-relaxed">
                  {{ i18n.t('landing.privacyBody') }}
                </p>
              </div>

              <div class="divide-y divide-[#E8EAED] border-t border-b border-[#E8EAED] text-[14px]">
                <div class="py-3.5 flex items-baseline justify-between gap-4">
                  <span class="font-semibold text-[#202124]">{{ i18n.t('landing.specAuthTitle') }}</span>
                  <span class="text-[#5F6368] text-right">{{ i18n.t('landing.specAuthValue') }}</span>
                </div>
                <div class="py-3.5 flex items-baseline justify-between gap-4">
                  <span class="font-semibold text-[#202124]">{{ i18n.t('landing.specDataTitle') }}</span>
                  <span class="text-[#5F6368] text-right">{{ i18n.t('landing.specDataValue') }}</span>
                </div>
                <div class="py-3.5 flex items-baseline justify-between gap-4">
                  <span class="font-semibold text-[#202124]">{{ i18n.t('landing.specCleanTitle') }}</span>
                  <span class="text-[#5F6368] text-right">{{ i18n.t('landing.specCleanValue') }}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Section 4: Quiet Final Conversion Band -->
        <section class="bg-[#F8F9FA] border-t border-b border-[#E8EAED]">
          <div class="max-w-4xl mx-auto px-6 sm:px-10 py-16 sm:py-20 text-center">
            <h2
              class="font-display text-2xl sm:text-3xl font-bold tracking-tight text-[#202124]"
              style="text-wrap: balance;"
            >
              {{ i18n.t('landing.ctaBandTitle') }}
            </h2>
            <p class="mt-3 text-[15px] text-[#5F6368] max-w-xl mx-auto leading-relaxed">
              {{ i18n.t('landing.ctaBandBody') }}
            </p>
            <div class="mt-7 flex flex-wrap items-center justify-center gap-4">
              <button
                type="button"
                (click)="openApp()"
                class="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-[15px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <mat-icon class="!text-[19px] !w-[19px] !h-[19px]" aria-hidden="true">arrow_forward</mat-icon>
                <span>{{ isSignedIn() ? i18n.t('landing.ctaBandWorkspace') : i18n.t('landing.ctaBandEnter') }}</span>
              </button>
              <button
                type="button"
                (click)="enterDemo()"
                class="inline-flex items-center gap-1.5 px-5 py-3 rounded-lg border border-[#DADCE0] bg-[#FFFFFF] hover:bg-[#F1F3F4] text-[#202124] text-[15px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <span>{{ i18n.t('landing.ctaBandTryDemo') }}</span>
              </button>
            </div>
          </div>
        </section>
      </main>

      <!-- Quiet Footer: Brand, Navigation, Legal/Privacy/License, Contacts & Copyright -->
      <footer class="bg-[#FFFFFF] text-[#5F6368]">
        <div class="max-w-6xl mx-auto px-6 sm:px-10 py-12 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-8">
          <div class="lg:col-span-5 space-y-2.5">
            <button
              type="button"
              (click)="scrollToTop()"
              class="inline-flex items-center gap-2 whitespace-nowrap cursor-pointer"
            >
              <img
                src="/icons/pwa-192x192.png"
                alt=""
                referrerpolicy="no-referrer"
                class="w-7 h-7 rounded-lg shrink-0"
              />
              <span class="font-display font-bold text-base tracking-tight text-[#202124]">
                CronoSheet
              </span>
            </button>
            <p class="text-[13px] text-[#5F6368] leading-relaxed max-w-sm">
              {{ i18n.t('landing.footerTagline') }}
            </p>
          </div>

          <div class="lg:col-span-2 space-y-2.5 text-[13px]">
            <p class="font-semibold text-[#202124]">{{ i18n.t('landing.footerProduct') }}</p>
            <ul class="space-y-2">
              <li>
                <button
                  type="button"
                  (click)="openApp()"
                  class="hover:text-[#1A73E8] transition-colors cursor-pointer"
                >
                  {{ i18n.t('landing.navApp') }}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  (click)="enterDemo()"
                  class="hover:text-[#1A73E8] transition-colors cursor-pointer"
                >
                  {{ i18n.t('sidebar.modeDemo') }}
                </button>
              </li>
              <li>
                <a href="#come-funziona" class="hover:text-[#1A73E8] transition-colors">
                  {{ i18n.t('landing.footerHowItWorks') }}
                </a>
              </li>
            </ul>
          </div>

          <div class="lg:col-span-2 space-y-2.5 text-[13px]">
            <p class="font-semibold text-[#202124]">{{ i18n.t('landing.footerLegal') }}</p>
            <ul class="space-y-2">
              <li>
                <button
                  type="button"
                  (click)="openLegalModal('privacy')"
                  class="hover:text-[#1A73E8] transition-colors cursor-pointer"
                >
                  {{ i18n.t('landing.footerPrivacy') }}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  (click)="openLegalModal('terms')"
                  class="hover:text-[#1A73E8] transition-colors cursor-pointer"
                >
                  {{ i18n.t('landing.footerTerms') }}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  (click)="openLegalModal('license')"
                  class="hover:text-[#1A73E8] transition-colors cursor-pointer"
                >
                  {{ i18n.t('landing.footerLicense') }}
                </button>
              </li>
            </ul>
          </div>

          <div class="lg:col-span-3 space-y-2.5 text-[13px]">
            <p class="font-semibold text-[#202124]">{{ i18n.t('landing.footerProject') }}</p>
            <ul class="space-y-2">
              <li>
                <button
                  type="button"
                  (click)="openFeedback()"
                  class="hover:text-[#1A73E8] transition-colors cursor-pointer"
                >
                  {{ i18n.t('landing.footerFeedback') }}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  (click)="openLegalModal('contact')"
                  class="hover:text-[#1A73E8] transition-colors cursor-pointer"
                >
                  {{ i18n.t('landing.footerContacts') }}
                </button>
              </li>
              <li>
                <a
                  href="https://github.com/odevero"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="hover:text-[#1A73E8] transition-colors"
                >
                  GitHub (odevero)
                </a>
              </li>
              <li>
                <a
                  href="https://gitlab.com/odevero"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="hover:text-[#1A73E8] transition-colors"
                >
                  GitLab (odevero)
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div class="border-t border-[#E8EAED]">
          <div class="max-w-6xl mx-auto px-6 sm:px-10 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-[12px] text-[#80868B]">
            <p>© 2026 Orso De Vero · CronoSheet · GNU AGPL-3.0</p>
            <div class="flex items-center gap-3">
              <button
                type="button"
                (click)="openLegalModal('privacy')"
                class="hover:text-[#202124] transition-colors cursor-pointer"
              >
                {{ i18n.t('landing.footerShortPrivacy') }}
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                (click)="openLegalModal('terms')"
                class="hover:text-[#202124] transition-colors cursor-pointer"
              >
                {{ i18n.t('landing.footerShortTerms') }}
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                (click)="openLegalModal('license')"
                class="hover:text-[#202124] transition-colors cursor-pointer"
              >
                {{ i18n.t('landing.footerShortLicense') }}
              </button>
              <span aria-hidden="true">·</span>
              <button
                type="button"
                (click)="openFeedback()"
                class="hover:text-[#1A73E8] transition-colors cursor-pointer"
              >
                {{ i18n.t('landing.footerShortFeedback') }}
              </button>
            </div>
          </div>
        </div>
      </footer>

      <!-- Accessible Legal / Contact Dialog -->
      @if (activeLegalModal(); as topic) {
        <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            (click)="closeLegalModal()"
            [attr.aria-label]="i18n.t('legal.closeAria')"
            class="fixed inset-0 bg-[#202124]/40 cursor-default"
          ></button>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="legal-dialog-title"
            class="relative z-10 w-full max-w-lg rounded-2xl bg-[#FFFFFF] border border-[#DADCE0] shadow-xl p-6 sm:p-7 space-y-4"
          >
            <div class="flex items-start justify-between gap-4">
              <h2 id="legal-dialog-title" class="font-display text-lg font-bold text-[#202124]">
                @switch (topic) {
                  @case ('privacy') { {{ i18n.t('legal.privacyTitle') }} }
                  @case ('terms') { {{ i18n.t('legal.termsTitle') }} }
                  @case ('license') { {{ i18n.t('legal.licenseTitle') }} }
                  @case ('contact') { {{ i18n.t('legal.contactTitle') }} }
                }
              </h2>
              <button
                type="button"
                (click)="closeLegalModal()"
                [attr.aria-label]="i18n.t('legal.closeAria')"
                class="p-1 rounded-lg text-[#5F6368] hover:bg-[#F1F3F4] cursor-pointer"
              >
                <mat-icon class="!text-[20px] !w-[20px] !h-[20px]">close</mat-icon>
              </button>
            </div>

            <div class="text-[14px] text-[#3C4043] leading-relaxed space-y-3">
              @switch (topic) {
                @case ('privacy') {
                  <p>{{ i18n.t('legal.privacyP1') }}</p>
                  <p>{{ i18n.t('legal.privacyP2') }}</p>
                }
                @case ('terms') {
                  <p>{{ i18n.t('legal.termsP1') }}</p>
                  <p>{{ i18n.t('legal.termsP2') }}</p>
                }
                @case ('license') {
                  <p>
                    {{ i18n.t('legal.licenseP1Before') }}
                    <strong class="font-semibold text-[#202124]">{{ i18n.t('legal.licenseP1Strong') }}</strong>{{ i18n.t('legal.licenseP1After') }}
                  </p>
                  <p class="text-[#5F6368]">{{ i18n.t('legal.licenseP2') }}</p>
                }
                @case ('contact') {
                  <p>
                    {{ i18n.t('legal.contactByBefore') }}
                    <strong class="font-semibold text-[#202124]">Orso De Vero</strong>.
                  </p>
                  <ul class="space-y-1.5 text-[14px]">
                    <li>
                      GitHub:
                      <a
                        href="https://github.com/odevero"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-[#1A73E8] hover:underline"
                      >
                        github.com/odevero
                      </a>
                    </li>
                    <li>
                      GitLab:
                      <a
                        href="https://gitlab.com/odevero"
                        target="_blank"
                        rel="noopener noreferrer"
                        class="text-[#1A73E8] hover:underline"
                      >
                        gitlab.com/odevero
                      </a>
                    </li>
                  </ul>
                  <p class="text-[#5F6368]">{{ i18n.t('legal.contactBugPrompt') }}</p>
                  <div class="pt-1">
                    <button
                      type="button"
                      (click)="openFeedbackFromContact()"
                      class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#E8F0FE] hover:bg-[#D2E3FC] text-[#174EA6] text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <mat-icon class="!text-[16px] !w-[16px] !h-[16px]" aria-hidden="true">
                        feedback
                      </mat-icon>
                      <span>{{ i18n.t('legal.contactOpenFeedback') }}</span>
                    </button>
                  </div>
                }
              }
            </div>

            <div class="pt-2 flex justify-end">
              <button
                type="button"
                (click)="closeLegalModal()"
                class="px-4 py-2 rounded-lg bg-[#202124] hover:bg-[#3C4043] text-white text-sm font-medium transition-colors cursor-pointer"
              >
                {{ i18n.t('common.close') }}
              </button>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class LandingPage {
  protected readonly store = inject(WorkspaceStore);
  protected readonly i18n = inject(I18nService);
  protected readonly todayIso = getTodayIsoLocal();
  protected readonly activeLegalModal = signal<LegalTopic>(null);
  protected readonly copiedKey = signal<'days' | 'ymw' | null>(null);

  protected readonly presets: readonly PreviewPreset[] = [
    {
      id: 'ongoing',
      labelKey: 'landing.presetOngoing',
      title: 'run 5km every morning',
      startOffsetDays: -363,
      endOffsetDays: null,
      accentColor: '#1A73E8',
    },
    {
      id: 'milestone',
      labelKey: 'landing.presetMilestone',
      title: 'stay sugar-free for 100 days',
      startOffsetDays: -97,
      endOffsetDays: null,
      accentColor: '#137333',
    },
    {
      id: 'completed',
      labelKey: 'landing.presetCompleted',
      title: 'pass Cloud Fundamentals exam',
      startOffsetDays: -120,
      endOffsetDays: -28,
      accentColor: '#C5221F',
    },
  ];

  protected readonly selectedPresetId = signal<string>('ongoing');
  protected readonly customStartDate = signal<string | null>(null);

  protected readonly activePreset = computed(
    () => this.presets.find((p) => p.id === this.selectedPresetId()) ?? this.presets[0],
  );

  protected readonly previewStartDate = computed(
    () =>
      this.customStartDate() ??
      addCalendarDays(this.todayIso, this.activePreset().startOffsetDays),
  );

  protected readonly previewEndDate = computed(() => {
    const endOffset = this.activePreset().endOffsetDays;
    return endOffset === null ? '' : addCalendarDays(this.todayIso, endOffset);
  });

  protected readonly previewMetrics = computed(() =>
    computeGoalMetrics(
      {
        id: 'preview',
        ownerId: 'preview',
        title: this.activePreset().title,
        startDate: this.previewStartDate(),
        endDate: this.previewEndDate(),
        notes: '',
        sortOrder: 0,
        createdAtIso: this.todayIso,
        updatedAtIso: this.todayIso,
      },
      this.todayIso,
    ),
  );

  protected readonly isSignedIn = computed(() => this.store.authStage() === 'authenticated');

  protected selectPreset(id: string): void {
    this.selectedPresetId.set(id);
    this.customStartDate.set(null);
    this.copiedKey.set(null);
  }

  protected onPreviewDateChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (val) {
      this.customStartDate.set(val);
    }
  }

  protected formatShort(iso: string): string {
    return formatDateShort(iso);
  }

  protected async copyPreviewMessage(text: string, key: 'days' | 'ymw'): Promise<void> {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // Clipboard permission unavailable in headless/sandbox context
      }
    }
    this.copiedKey.set(key);
    window.setTimeout(() => {
      if (this.copiedKey() === key) {
        this.copiedKey.set(null);
      }
    }, 1500);
  }

  protected openApp(): void {
    this.store.openApp();
    this.scrollToTop();
  }

  protected enterDemo(): void {
    void this.store.enterDemoMode();
    this.scrollToTop();
  }

  protected openLegalModal(topic: Exclude<LegalTopic, null>): void {
    this.activeLegalModal.set(topic);
  }

  protected closeLegalModal(): void {
    this.activeLegalModal.set(null);
  }

  protected openFeedback(): void {
    this.store.openFeedbackModal('landing');
  }

  protected openFeedbackFromContact(): void {
    this.activeLegalModal.set(null);
    this.store.openFeedbackModal('landing');
  }

  protected scrollToTop(): void {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}
