import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { getTodayIsoLocal } from '../core/domain/services/calendar-duration';
import { WorkspaceStore, WorkspaceTab } from '../core/main/workspace-store';
import { AuthGate } from './views/auth-gate';
import { DataSheet } from './views/data-sheet';
import { FilterSortView } from './views/filter-sort-view';
import { NextRoadmapView } from './views/next-roadmap-view';
import { RecurrencesView } from './views/recurrences-view';
import { SecurityView } from './views/security-view';
import { TipsView } from './views/tips-view';
import { ShowcaseShell } from './showcase/showcase-shell';
import { LandingPage } from './landing/landing-page';
import { FeedbackModal } from './components/feedback-modal';
import { NameOnboardingModal } from './components/name-onboarding-modal';
import { PwaInstallBanner } from './components/pwa-install-banner';
import { LanguageSwitcher } from './components/language-switcher';
import { SocialShareModal } from './components/social-share-modal';
import { ImportGoalsModal } from './components/import-goals-modal';
import { I18nService } from './services/i18n';
import { TranslationKey } from '../core/i18n/it';

interface NavTabItem {
  readonly id: WorkspaceTab;
  readonly labelKey: TranslationKey;
  readonly icon: string;
  readonly accentHex: string;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [
    MatIconModule,
    LandingPage,
    AuthGate,
    ShowcaseShell,
    DataSheet,
    RecurrencesView,
    TipsView,
    FilterSortView,
    SecurityView,
    NextRoadmapView,
    FeedbackModal,
    NameOnboardingModal,
    PwaInstallBanner,
    LanguageSwitcher,
    SocialShareModal,
    ImportGoalsModal,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
  host: {
    '(window:keydown)': 'onGlobalKeydown($event)',
  },
})
export class App {
  protected readonly store = inject(WorkspaceStore);
  protected readonly i18n = inject(I18nService);
  protected readonly mobileMenuOpen = signal(false);
  protected readonly todayIso = getTodayIsoLocal();

  protected readonly navTabs: readonly NavTabItem[] = [
    { id: 'data', labelKey: 'sidebar.tabData', icon: 'table_rows', accentHex: '#1A73E8' },
    { id: 'recurrences', labelKey: 'sidebar.tabRecurrences', icon: 'event_repeat', accentHex: '#EA4335' },
    { id: 'memo', labelKey: 'sidebar.tabMemo', icon: 'sticky_note_2', accentHex: '#FBBC04' },
    { id: 'filtersort', labelKey: 'sidebar.tabFilterSort', icon: 'filter_list', accentHex: '#34A853' },
    { id: 'next', labelKey: 'sidebar.tabNext', icon: 'checklist', accentHex: '#5F6368' },
    { id: 'security', labelKey: 'sidebar.tabSecurity', icon: 'verified_user', accentHex: '#1A73E8' },
  ];

  protected readonly activeTabTitle = computed(() => {
    const curr = this.store.activeTab();
    const tab = this.navTabs.find((t) => t.id === curr);
    return tab ? this.i18n.t(tab.labelKey) : this.i18n.t('sidebar.tabData');
  });

  protected readonly isCustomReferenceDate = computed(
    () => this.store.referenceDateIso() !== this.todayIso,
  );

  protected selectTab(tab: WorkspaceTab): void {
    this.store.activeTab.set(tab);
    this.store.clearBanner();
    this.mobileMenuOpen.set(false);
  }

  protected focusNewRow(): void {
    this.mobileMenuOpen.set(false);
    this.store.focusInlineNewRow();
  }

  protected onReferenceDateChange(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    if (val) {
      this.store.referenceDateIso.set(val);
    }
  }

  protected resetReferenceDateToToday(): void {
    this.store.referenceDateIso.set(getTodayIsoLocal());
  }

  protected tabBadgeCount(id: WorkspaceTab): number | null {
    if (id === 'data') return this.store.summaryStats().total;
    if (id === 'recurrences') return this.store.summaryStats().upcomingRecurrences;
    if (id === 'memo') return this.store.summaryStats().openMemos;
    return null;
  }

  protected openShowcase(): void {
    this.mobileMenuOpen.set(false);
    this.store.clearBanner();
    this.store.workspaceMode.set('showcase');
  }

  protected openLandingFromSidebar(): void {
    this.mobileMenuOpen.set(false);
    this.store.openLanding();
  }

  protected openFeedback(): void {
    this.mobileMenuOpen.set(false);
    this.store.openFeedbackModal('backend');
  }

  protected onGlobalKeydown(event: KeyboardEvent): void {
    if (this.store.appSurface() !== 'app') return;
    if (this.store.authStage() !== 'authenticated') return;
    if (this.store.workspaceMode() !== 'backend') return;

    const mod = event.ctrlKey || event.metaKey;
    if (!mod || event.altKey) return;

    const key = event.key.toLowerCase();
    const isUndo = key === 'z' && !event.shiftKey;
    const isRedo = (key === 'z' && event.shiftKey) || (key === 'y' && !event.shiftKey);
    if (!isUndo && !isRedo) return;

    // If user is mid-edit inside a cell with unsaved characters, let native text undo work first.
    const active = document.activeElement as HTMLElement | null;
    if (active) {
      if (active.dataset['dirty'] === 'true') {
        return;
      }
      // For standalone form inputs (e.g. search or quick-add drafts with text), preserve native text undo
      const isPlainFormText =
        (active.tagName === 'INPUT' &&
          !['date', 'checkbox', 'radio', 'range', 'button', 'submit'].includes(
            (active as HTMLInputElement).type,
          )) ||
        (active.tagName === 'TEXTAREA' && active.dataset['cellCol'] === undefined);
      if (isPlainFormText && (active as HTMLInputElement | HTMLTextAreaElement).value.length > 0) {
        return;
      }
    }

    if (isUndo && this.store.canUndo()) {
      event.preventDefault();
      void this.store.undo();
    } else if (isRedo && this.store.canRedo()) {
      event.preventDefault();
      void this.store.redo();
    }
  }
}
