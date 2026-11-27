import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { WorkspaceStore } from '../../core/main/workspace-store';
import { LanguageSwitcher } from '../components/language-switcher';
import { I18nService } from '../services/i18n';
import { ShowcaseActivities } from './showcase-activities';
import { ShowcaseRecurrences } from './showcase-recurrences';

export type ShowcaseTab = 'activities' | 'recurrences';

function readLocalTime(): { hours: number; minutes: number } {
  const now = new Date();
  return { hours: now.getHours(), minutes: now.getMinutes() };
}

/**
 * Decoupled, full-screen, Google-homepage-inspired post-login presentation view.
 * Operates strictly in read-only mode on the shared WorkspaceStore data models,
 * completely separated from the operational Backend/Editor workspace.
 */
@Component({
  selector: 'app-showcase-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule, LanguageSwitcher, ShowcaseActivities, ShowcaseRecurrences],
  template: `
    <div class="min-h-screen w-full bg-[#FFFFFF] text-[#202124] flex flex-col">
      <!-- Dynamic Compact Sticky Top Bar (Row 1 when scrolled down) -->
      <div
        data-testid="showcase-sticky-header"
        [attr.aria-hidden]="!isScrolled()"
        [attr.inert]="!isScrolled() ? '' : null"
        [class]="
          isScrolled()
            ? 'fixed top-0 inset-x-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-[#E8EAED] shadow-[0_1px_3px_rgba(60,64,67,0.06)] transition-[transform,opacity] duration-200 ease-out translate-y-0 opacity-100'
            : 'fixed top-0 inset-x-0 z-30 h-14 bg-white/95 backdrop-blur-md border-b border-[#E8EAED] transition-[transform,opacity] duration-200 ease-out -translate-y-full opacity-0 pointer-events-none'
        "
      >
        <div class="h-full w-full px-4 sm:px-6 lg:px-10 xl:px-14 flex items-center gap-3 xl:gap-4">
          <!-- 1. Clickable App Logo + Non-Clickable Brand Name (top-left) -->
          <div class="flex items-center gap-2.5 min-w-0 shrink-0">
            <button
              type="button"
              (click)="store.openLanding()"
              [title]="i18n.t('showcase.backLanding')"
              [attr.aria-label]="i18n.t('showcase.backLanding')"
              data-testid="sticky-landing-logo-btn"
              class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 cursor-pointer hover:opacity-90 active:scale-[0.97] transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1A73E8]"
            >
              <img
                src="/icons/pwa-192x192.png"
                alt=""
                referrerpolicy="no-referrer"
                class="w-7 h-7 rounded-lg block"
              />
            </button>
            <span
              class="hidden sm:inline font-display text-[15px] font-bold tracking-tight text-[#202124] whitespace-nowrap truncate max-w-[160px] xl:max-w-[230px] select-text"
              data-testid="sticky-brand-title"
            >
              {{ localizedBrandTitle() }}
            </span>
          </div>

          <!-- 2. Reference Date immediately after brand (top-left on desktop) -->
          <div
            class="hidden md:inline-flex items-center gap-2 text-[12px] text-[#80868B] tabular-nums whitespace-nowrap shrink-0"
            data-testid="sticky-reference-date"
          >
            <span class="text-[#DADCE0]" aria-hidden="true">·</span>
            <span>{{ formattedReferenceDate() }}</span>
          </div>

          <!-- 3. Activities / Recurrences Switcher right beside date -->
          <nav
            class="h-full flex items-center gap-4 lg:gap-5 sm:pl-3 sm:border-l sm:border-[#E8EAED] shrink-0"
            role="tablist"
            aria-label="Viste di consultazione"
            data-testid="sticky-tab-switcher"
          >
            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeTab() === 'activities'"
              (click)="selectTab('activities')"
              data-testid="sticky-tab-activities"
              [class]="
                activeTab() === 'activities'
                  ? 'h-full inline-flex items-center text-[13px] font-semibold text-[#1A73E8] border-b-2 border-[#1A73E8] transition-colors whitespace-nowrap shrink-0 cursor-pointer'
                  : 'h-full inline-flex items-center text-[13px] font-medium text-[#5F6368] hover:text-[#202124] border-b-2 border-transparent transition-colors whitespace-nowrap shrink-0 cursor-pointer'
              "
            >
              <span>{{ i18n.t('showcase.tabActivities') }}</span>
              <span class="ml-1.5 text-[12px] font-normal text-[#80868B] tabular-nums">
                {{ store.summaryStats().total }}
              </span>
            </button>

            <button
              type="button"
              role="tab"
              [attr.aria-selected]="activeTab() === 'recurrences'"
              (click)="selectTab('recurrences')"
              data-testid="sticky-tab-recurrences"
              [class]="
                activeTab() === 'recurrences'
                  ? 'h-full inline-flex items-center text-[13px] font-semibold text-[#1A73E8] border-b-2 border-[#1A73E8] transition-colors whitespace-nowrap shrink-0 cursor-pointer'
                  : 'h-full inline-flex items-center text-[13px] font-medium text-[#5F6368] hover:text-[#202124] border-b-2 border-transparent transition-colors whitespace-nowrap shrink-0 cursor-pointer'
              "
            >
              <span>{{ i18n.t('showcase.tabRecurrences') }}</span>
              <span class="ml-1.5 text-[12px] font-normal text-[#80868B] tabular-nums">
                {{ store.summaryStats().upcomingRecurrences }}
              </span>
            </button>
          </nav>

          <!-- 4. Utility Actions on the right: Language, Manage Data, Feedback, Logout -->
          <div class="ml-auto flex items-center gap-2 lg:gap-3 xl:gap-4 text-[13px] text-[#5F6368] shrink-0">
            <div class="hidden sm:inline-flex shrink-0">
              <app-language-switcher />
            </div>

            <span class="text-[#DADCE0] hidden xl:inline" aria-hidden="true">·</span>

            <button
              type="button"
              (click)="openBackend()"
              [title]="i18n.t('showcase.manageData')"
              [attr.aria-label]="i18n.t('showcase.manageData')"
              class="inline-flex items-center gap-1.5 p-1.5 lg:p-0 rounded-lg lg:rounded-none text-[#3C4043] hover:text-[#1A73E8] hover:bg-[#F1F3F4] lg:hover:bg-transparent transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <mat-icon class="!text-[18px] lg:!text-[17px] !w-[18px] lg:!w-[17px] !h-[18px] lg:!h-[17px]">edit_note</mat-icon>
              <span class="hidden lg:inline">{{ i18n.t('showcase.manageData') }}</span>
            </button>

            <span class="text-[#DADCE0] hidden lg:inline" aria-hidden="true">·</span>

            <button
              type="button"
              (click)="openFeedback()"
              [title]="i18n.t('showcase.feedback')"
              [attr.aria-label]="i18n.t('showcase.feedback')"
              class="inline-flex items-center gap-1.5 p-1.5 lg:p-0 rounded-lg lg:rounded-none text-[#5F6368] hover:text-[#1A73E8] hover:bg-[#F1F3F4] lg:hover:bg-transparent transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <mat-icon class="!text-[17px] lg:!text-[16px] !w-[17px] lg:!w-[16px] !h-[17px] lg:!h-[16px]">feedback</mat-icon>
              <span class="hidden lg:inline">{{ i18n.t('showcase.feedback') }}</span>
            </button>

            <span class="text-[#DADCE0] hidden lg:inline" aria-hidden="true">·</span>

            <button
              type="button"
              (click)="store.logout()"
              [title]="i18n.t('showcase.logout')"
              [attr.aria-label]="i18n.t('sidebar.logout')"
              class="inline-flex items-center gap-1 p-1.5 lg:p-0 rounded-lg lg:rounded-none text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4] lg:hover:bg-transparent transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <mat-icon class="!text-[17px] lg:!text-[16px] !w-[17px] lg:!w-[16px] !h-[17px] lg:!h-[16px]">logout</mat-icon>
              <span class="hidden lg:inline">{{ i18n.t('showcase.logout') }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Resting Whisper-quiet top bar (Google Homepage top-right style) -->
      <header class="w-full px-6 sm:px-10 lg:px-10 xl:px-14 pt-4 pb-2 flex flex-wrap items-center justify-end gap-4 sm:gap-5 text-[13px] text-[#5F6368]">
        <app-language-switcher />

        <span class="text-[#DADCE0] hidden sm:inline" aria-hidden="true">·</span>

        <button
          type="button"
          (click)="openBackend()"
          class="inline-flex items-center gap-1.5 text-[#3C4043] hover:text-[#1A73E8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <mat-icon class="!text-[17px] !w-[17px] !h-[17px]">edit_note</mat-icon>
          <span>{{ i18n.t('showcase.manageData') }}</span>
        </button>

        <span class="text-[#DADCE0]" aria-hidden="true">·</span>

        <button
          type="button"
          (click)="openFeedback()"
          class="inline-flex items-center gap-1.5 text-[#5F6368] hover:text-[#1A73E8] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">feedback</mat-icon>
          <span>{{ i18n.t('showcase.feedback') }}</span>
        </button>

        <span class="text-[#DADCE0]" aria-hidden="true">·</span>

        <button
          type="button"
          (click)="store.logout()"
          [attr.aria-label]="i18n.t('sidebar.logout')"
          class="inline-flex items-center gap-1 text-[#5F6368] hover:text-[#202124] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">logout</mat-icon>
          <span>{{ i18n.t('showcase.logout') }}</span>
        </button>
      </header>

      <!-- Centered Google-Homepage-Style Brand Mark & 2 Minimal Tabs -->
      <div class="w-full px-6 sm:px-10 lg:px-10 xl:px-14 pt-4 pb-8 flex flex-col items-center">
        <div class="flex items-center gap-3 max-w-full">
          <button
            type="button"
            (click)="store.openLanding()"
            [title]="i18n.t('showcase.backLanding')"
            [attr.aria-label]="i18n.t('showcase.backLanding')"
            class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 cursor-pointer hover:opacity-90 active:scale-[0.97] transition focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1A73E8]"
          >
            <img
              src="/icons/pwa-192x192.png"
              alt=""
              referrerpolicy="no-referrer"
              class="w-10 h-10 rounded-xl block"
            />
          </button>
          <h1 class="font-display text-2xl sm:text-[34px] font-bold tracking-tight text-[#202124] truncate select-text">
            {{ localizedBrandTitle() }}
          </h1>
        </div>

        <p class="mt-1.5 text-[13px] text-[#80868B] tabular-nums">
          {{ formattedReferenceDate() }}
        </p>

        <!-- Minimal 2-Tab Navigation (Google Search underline tabs, zero borders or pills) -->
        <nav
          class="mt-6 flex items-center gap-8 border-b border-[#F1F3F4]"
          role="tablist"
          aria-label="Viste di consultazione"
        >
          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeTab() === 'activities'"
            (click)="selectTab('activities')"
            [class]="
              activeTab() === 'activities'
                ? 'pb-2.5 text-[15px] font-semibold text-[#1A73E8] border-b-2 border-[#1A73E8] -mb-px transition-colors whitespace-nowrap shrink-0 cursor-pointer'
                : 'pb-2.5 text-[15px] font-medium text-[#5F6368] hover:text-[#202124] border-b-2 border-transparent -mb-px transition-colors whitespace-nowrap shrink-0 cursor-pointer'
            "
          >
            {{ i18n.t('showcase.tabActivities') }}
            <span class="ml-1.5 text-[13px] font-normal text-[#80868B] tabular-nums">
              {{ store.summaryStats().total }}
            </span>
          </button>

          <button
            type="button"
            role="tab"
            [attr.aria-selected]="activeTab() === 'recurrences'"
            (click)="selectTab('recurrences')"
            [class]="
              activeTab() === 'recurrences'
                ? 'pb-2.5 text-[15px] font-semibold text-[#1A73E8] border-b-2 border-[#1A73E8] -mb-px transition-colors whitespace-nowrap shrink-0 cursor-pointer'
                : 'pb-2.5 text-[15px] font-medium text-[#5F6368] hover:text-[#202124] border-b-2 border-transparent -mb-px transition-colors whitespace-nowrap shrink-0 cursor-pointer'
            "
          >
            {{ i18n.t('showcase.tabRecurrences') }}
            <span class="ml-1.5 text-[13px] font-normal text-[#80868B] tabular-nums">
              {{ store.summaryStats().upcomingRecurrences }}
            </span>
          </button>
        </nav>
      </div>

      <!-- Full-Screen Edge-to-Edge Read-Only Content -->
      <main class="flex-1 w-full px-6 sm:px-10 lg:px-10 xl:px-14 pb-16">
        @if (activeTab() === 'activities') {
          <app-showcase-activities (openBackend)="openBackend()" />
        } @else {
          <app-showcase-recurrences />
        }
      </main>
    </div>
  `,
})
export class ShowcaseShell {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly store = inject(WorkspaceStore);
  protected readonly i18n = inject(I18nService);
  protected readonly activeTab = signal<ShowcaseTab>('activities');
  protected readonly isScrolled = signal<boolean>(false);
  private readonly nowTime = signal<{ hours: number; minutes: number }>(readLocalTime());

  constructor() {
    if (typeof window !== 'undefined') {
      const timer = window.setInterval(() => {
        const next = readLocalTime();
        const prev = this.nowTime();
        if (next.hours !== prev.hours || next.minutes !== prev.minutes) {
          this.nowTime.set(next);
        }
      }, 15_000);

      const handleScroll = (): void => {
        const y = window.scrollY;
        if (!this.isScrolled() && y > 96) {
          this.isScrolled.set(true);
        } else if (this.isScrolled() && y < 72) {
          this.isScrolled.set(false);
        }
      };
      handleScroll();
      window.addEventListener('scroll', handleScroll, { passive: true });

      this.destroyRef.onDestroy(() => {
        window.clearInterval(timer);
        window.removeEventListener('scroll', handleScroll);
      });
    }
  }

  protected readonly localizedBrandTitle = computed(() =>
    this.i18n.formatShowcaseBrand(this.store.showcaseOwnerName()),
  );

  protected readonly formattedReferenceDate = computed(() => {
    const { hours, minutes } = this.nowTime();
    return this.i18n.formatDateTime(this.store.referenceDateIso(), hours, minutes);
  });

  protected selectTab(tab: ShowcaseTab): void {
    const changed = this.activeTab() !== tab;
    this.activeTab.set(tab);
    if (changed && this.isScrolled() && typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  protected openBackend(): void {
    this.store.workspaceMode.set('backend');
  }

  protected openFeedback(): void {
    this.store.openFeedbackModal('showcase');
  }
}
