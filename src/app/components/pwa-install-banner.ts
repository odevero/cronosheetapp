import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { resolveInstallBannerMode } from '../../core/domain/services/pwa-install';
import { I18nService } from '../services/i18n';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISS_STORAGE_KEY = 'cronosheet_pwa_install_dismissed_v1';

@Component({
  selector: 'app-pwa-install-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  template: `
    @if (!isOnline()) {
      <div
        role="status"
        aria-live="polite"
        class="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-[#202124] px-3.5 py-2 text-xs font-medium text-white shadow-md"
      >
        <mat-icon class="!text-[16px] !w-[16px] !h-[16px] text-[#FBBC04]" aria-hidden="true">
          cloud_off
        </mat-icon>
        <span>{{ i18n.t('pwa.offline') }}</span>
      </div>
    }

    @if (bannerMode() === 'prompt') {
      <aside
        [attr.aria-label]="i18n.t('pwa.installTitle')"
        class="fixed bottom-4 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm rounded-2xl bg-[#FFFFFF] border border-[#DADCE0] shadow-md p-3.5 flex items-center gap-3"
      >
        <img
          src="/icons/pwa-192x192.png"
          alt=""
          referrerpolicy="no-referrer"
          class="w-10 h-10 rounded-xl shrink-0"
        />
        <div class="min-w-0 flex-1">
          <p class="text-[13px] font-semibold text-[#202124] leading-snug">
            {{ i18n.t('pwa.installTitle') }}
          </p>
          <p class="text-[12px] text-[#5F6368] leading-snug">
            {{ i18n.t('pwa.installBody') }}
          </p>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button
            type="button"
            (click)="triggerInstall()"
            [disabled]="installing()"
            class="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-xs font-semibold transition-colors disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            <mat-icon class="!text-[15px] !w-[15px] !h-[15px]" aria-hidden="true">
              download
            </mat-icon>
            <span>{{ i18n.t('pwa.installBtn') }}</span>
          </button>
          <button
            type="button"
            (click)="dismiss()"
            [attr.aria-label]="i18n.t('common.close')"
            class="p-1.5 rounded-lg text-[#5F6368] hover:bg-[#F1F3F4] transition-colors cursor-pointer"
          >
            <mat-icon class="!text-[17px] !w-[17px] !h-[17px]" aria-hidden="true">close</mat-icon>
          </button>
        </div>
      </aside>
    } @else if (bannerMode() === 'ios-guide') {
      <aside
        [attr.aria-label]="i18n.t('pwa.iosTitle')"
        class="fixed bottom-4 right-4 z-40 w-[calc(100vw-2rem)] max-w-sm rounded-2xl bg-[#FFFFFF] border border-[#DADCE0] shadow-md p-3.5 flex items-start gap-3"
      >
        <img
          src="/icons/pwa-192x192.png"
          alt=""
          referrerpolicy="no-referrer"
          class="w-10 h-10 rounded-xl shrink-0 mt-0.5"
        />
        <div class="min-w-0 flex-1">
          <p class="text-[13px] font-semibold text-[#202124] leading-snug">
            {{ i18n.t('pwa.iosTitle') }}
          </p>
          <p class="mt-0.5 text-[12px] text-[#5F6368] leading-relaxed">
            {{ i18n.t('pwa.iosBodyBefore') }} <strong class="font-semibold text-[#202124]">{{ i18n.t('pwa.iosShare') }}</strong> {{ i18n.t('pwa.iosBodyMid') }}
            <strong class="font-semibold text-[#202124]">{{ i18n.t('pwa.iosAddHome') }}</strong>.
          </p>
        </div>
        <button
          type="button"
          (click)="dismiss()"
          [attr.aria-label]="i18n.t('common.close')"
          class="p-1 rounded-lg text-[#5F6368] hover:bg-[#F1F3F4] transition-colors shrink-0 cursor-pointer"
        >
          <mat-icon class="!text-[17px] !w-[17px] !h-[17px]" aria-hidden="true">close</mat-icon>
        </button>
      </aside>
    }
  `,
})
export class PwaInstallBanner {
  private readonly destroyRef = inject(DestroyRef);
  protected readonly i18n = inject(I18nService);

  private readonly deferredPrompt = signal<BeforeInstallPromptEvent | null>(null);
  private readonly displayModeStandalone = signal<boolean>(false);
  private readonly navigatorStandalone = signal<boolean>(false);
  private readonly userAgent = signal<string>('');
  private readonly maxTouchPoints = signal<number>(0);
  private readonly dismissed = signal<boolean>(false);

  protected readonly installing = signal<boolean>(false);
  protected readonly isOnline = signal<boolean>(true);

  protected readonly bannerMode = computed(() =>
    resolveInstallBannerMode({
      userAgent: this.userAgent(),
      maxTouchPoints: this.maxTouchPoints(),
      displayModeStandalone: this.displayModeStandalone(),
      navigatorStandalone: this.navigatorStandalone(),
      hasDeferredPrompt: this.deferredPrompt() !== null,
      dismissed: this.dismissed(),
    }),
  );

  constructor() {
    if (typeof window === 'undefined') {
      return;
    }

    this.userAgent.set(window.navigator.userAgent ?? '');
    this.maxTouchPoints.set(window.navigator.maxTouchPoints ?? 0);
    this.isOnline.set(window.navigator.onLine ?? true);

    const navWithStandalone = window.navigator as Navigator & { standalone?: boolean };
    this.navigatorStandalone.set(navWithStandalone.standalone === true);

    const mediaQuery = window.matchMedia?.('(display-mode: standalone)');
    if (mediaQuery) {
      this.displayModeStandalone.set(mediaQuery.matches);
    }

    try {
      this.dismissed.set(window.localStorage.getItem(DISMISS_STORAGE_KEY) === '1');
    } catch {
      this.dismissed.set(false);
    }

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      this.deferredPrompt.set(event as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      this.displayModeStandalone.set(true);
      this.deferredPrompt.set(null);
    };

    const handleOnline = () => this.isOnline.set(true);
    const handleOffline = () => this.isOnline.set(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    this.destroyRef.onDestroy(() => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    });
  }

  protected async triggerInstall(): Promise<void> {
    const promptEvent = this.deferredPrompt();
    if (!promptEvent || this.installing()) {
      return;
    }

    this.installing.set(true);
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'accepted') {
        this.displayModeStandalone.set(true);
      }
      this.deferredPrompt.set(null);
    } catch {
      this.deferredPrompt.set(null);
    } finally {
      this.installing.set(false);
    }
  }

  protected dismiss(): void {
    this.dismissed.set(true);
    if (typeof window !== 'undefined') {
      try {
        window.localStorage.setItem(DISMISS_STORAGE_KEY, '1');
      } catch {
        // Ignore storage quota / private mode failures
      }
    }
  }
}
