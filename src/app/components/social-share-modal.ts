import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import {
  buildSocialShareFilename,
  getCardStatusTagKey,
  renderSocialShareCard,
  resolveShareAppUrl,
  SocialCardFormat,
  SocialCardMessageKind,
  SocialCardTheme,
} from '../../core/domain/services/social-share-card';
import { WorkspaceStore } from '../../core/main/workspace-store';
import { I18nService } from '../services/i18n';

@Component({
  selector: 'app-social-share-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [MatIconModule],
  host: {
    '(document:keydown.escape)': 'onEscape()',
  },
  template: `
    @if (store.socialShareGoal(); as enriched) {
      <div
        class="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 overflow-y-auto"
      >
        <button
          type="button"
          (click)="close()"
          [attr.aria-label]="i18n.t('common.close')"
          class="fixed inset-0 bg-black/50 backdrop-blur-[2px] cursor-default"
        ></button>
        <div
          role="dialog"
          aria-modal="true"
          [attr.aria-label]="i18n.t('social.modalTitle')"
          class="relative z-10 bg-white border border-[#DADCE0] rounded-2xl shadow-xl w-full max-w-4xl overflow-hidden my-auto"
        >
          <!-- Header -->
          <div class="px-5 py-4 border-b border-[#E8EAED] flex items-center justify-between gap-3">
            <div class="min-w-0">
              <h2 class="font-display text-base sm:text-lg font-bold text-[#202124] truncate">
                {{ i18n.t('social.modalTitle') }}
              </h2>
              <p class="text-xs text-[#5F6368] mt-0.5">
                {{ i18n.t('social.modalSubtitle') }}
              </p>
            </div>
            <button
              type="button"
              (click)="close()"
              [attr.aria-label]="i18n.t('common.close')"
              class="p-1.5 rounded-lg text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4] transition-colors cursor-pointer shrink-0"
            >
              <mat-icon class="!text-[20px] !w-[20px] !h-[20px]">close</mat-icon>
            </button>
          </div>

          <!-- Body: Preview Canvas + Controls -->
          <div class="grid grid-cols-1 md:grid-cols-12 gap-0">
            <!-- Left: Live Canvas Preview -->
            <div
              class="md:col-span-7 bg-[#F1F3F4] p-5 sm:p-6 flex items-center justify-center border-b md:border-b-0 md:border-r border-[#E8EAED] min-h-[300px]"
            >
              <div
                class="relative rounded-xl overflow-hidden shadow-md bg-white flex items-center justify-center"
                [class]="format() === 'story' ? 'w-[220px] sm:w-[250px]' : 'w-full max-w-[360px]'"
              >
                <canvas
                  #shareCanvas
                  class="block w-full h-auto"
                  data-testid="social-share-canvas"
                ></canvas>
                @if (rendering()) {
                  <div
                    class="absolute inset-0 bg-white/60 flex items-center justify-center text-xs font-medium text-[#3C4043]"
                  >
                    <mat-icon class="!text-[20px] !w-[20px] !h-[20px] animate-spin">progress_activity</mat-icon>
                  </div>
                }
              </div>
            </div>

            <!-- Right: Format, Message, Theme & Export Actions -->
            <div class="md:col-span-5 p-5 sm:p-6 flex flex-col justify-between gap-5">
              <div class="space-y-4">
                <!-- Format Selector -->
                <div class="space-y-1.5">
                  <span class="block text-[11px] font-semibold uppercase tracking-wider text-[#5F6368]">
                    Instagram
                  </span>
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      (click)="format.set('post')"
                      class="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer"
                      [class]="
                        format() === 'post'
                          ? 'bg-[#E8F0FE] border-[#1A73E8] text-[#174EA6]'
                          : 'bg-white border-[#DADCE0] text-[#3C4043] hover:bg-[#F8F9FA]'
                      "
                    >
                      <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">crop_square</mat-icon>
                      <span>{{ i18n.t('social.formatPost') }}</span>
                    </button>
                    <button
                      type="button"
                      (click)="format.set('story')"
                      class="flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-semibold transition-colors cursor-pointer"
                      [class]="
                        format() === 'story'
                          ? 'bg-[#E8F0FE] border-[#1A73E8] text-[#174EA6]'
                          : 'bg-white border-[#DADCE0] text-[#3C4043] hover:bg-[#F8F9FA]'
                      "
                    >
                      <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">crop_portrait</mat-icon>
                      <span>{{ i18n.t('social.formatStory') }}</span>
                    </button>
                  </div>
                </div>

                <!-- Message Selector -->
                <div class="space-y-1.5">
                  <span class="block text-[11px] font-semibold uppercase tracking-wider text-[#5F6368]">
                    {{ i18n.t('showcase.colMessages') }}
                  </span>
                  <div class="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      (click)="messageKind.set('days')"
                      class="px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer"
                      [class]="
                        messageKind() === 'days'
                          ? 'bg-[#E8F0FE] border-[#1A73E8] text-[#174EA6]'
                          : 'bg-white border-[#DADCE0] text-[#3C4043] hover:bg-[#F8F9FA]'
                      "
                    >
                      {{ i18n.t('social.msgDays') }}
                    </button>
                    <button
                      type="button"
                      (click)="messageKind.set('ymw')"
                      class="px-3 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer"
                      [class]="
                        messageKind() === 'ymw'
                          ? 'bg-[#E8F0FE] border-[#1A73E8] text-[#174EA6]'
                          : 'bg-white border-[#DADCE0] text-[#3C4043] hover:bg-[#F8F9FA]'
                      "
                    >
                      {{ i18n.t('social.msgYmw') }}
                    </button>
                  </div>
                </div>

                <!-- Theme Selector -->
                <div class="space-y-1.5">
                  <span class="block text-[11px] font-semibold uppercase tracking-wider text-[#5F6368]">
                    {{ i18n.t('social.themeLabel') }}
                  </span>
                  <div class="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      (click)="theme.set('gradient')"
                      class="px-2.5 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer"
                      [class]="
                        theme() === 'gradient'
                          ? 'bg-[#E8F0FE] border-[#1A73E8] text-[#174EA6]'
                          : 'bg-white border-[#DADCE0] text-[#3C4043] hover:bg-[#F8F9FA]'
                      "
                    >
                      {{ i18n.t('social.themeGradient') }}
                    </button>
                    <button
                      type="button"
                      (click)="theme.set('light')"
                      class="px-2.5 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer"
                      [class]="
                        theme() === 'light'
                          ? 'bg-[#E8F0FE] border-[#1A73E8] text-[#174EA6]'
                          : 'bg-white border-[#DADCE0] text-[#3C4043] hover:bg-[#F8F9FA]'
                      "
                    >
                      {{ i18n.t('social.themeLight') }}
                    </button>
                    <button
                      type="button"
                      (click)="theme.set('dark')"
                      class="px-2.5 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer"
                      [class]="
                        theme() === 'dark'
                          ? 'bg-[#E8F0FE] border-[#1A73E8] text-[#174EA6]'
                          : 'bg-white border-[#DADCE0] text-[#3C4043] hover:bg-[#F8F9FA]'
                      "
                    >
                      {{ i18n.t('social.themeDark') }}
                    </button>
                  </div>
                </div>

                @if (feedbackNotice(); as msg) {
                  <div
                    class="rounded-lg px-3 py-2 text-xs border"
                    [class]="
                      msg.tone === 'error'
                        ? 'bg-[#FCE8E6] border-[#F6AEA9] text-[#A50E0E]'
                        : 'bg-[#E6F4EA] border-[#A8DAB5] text-[#137333]'
                    "
                  >
                    {{ msg.text }}
                  </div>
                }
              </div>

              <!-- Primary Export Actions -->
              <div class="space-y-2.5 pt-3 border-t border-[#E8EAED]">
                <button
                  type="button"
                  (click)="copyImageToClipboard()"
                  [disabled]="busyAction()"
                  class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50"
                >
                  <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">content_copy</mat-icon>
                  <span>{{ i18n.t('social.copyImage') }}</span>
                </button>

                <div class="grid gap-2" [class]="canNativeShare() ? 'grid-cols-2' : 'grid-cols-1'">
                  @if (canNativeShare()) {
                    <button
                      type="button"
                      (click)="shareNative()"
                      [disabled]="busyAction()"
                      class="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#DADCE0] bg-white hover:bg-[#F8F9FA] text-[#202124] text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <mat-icon class="!text-[17px] !w-[17px] !h-[17px]">ios_share</mat-icon>
                      <span>{{ i18n.t('social.shareNative') }}</span>
                    </button>
                  }
                  <button
                    type="button"
                    (click)="downloadPng(enriched.goal.title)"
                    [disabled]="busyAction()"
                    class="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[#DADCE0] bg-white hover:bg-[#F8F9FA] text-[#202124] text-sm font-medium transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <mat-icon class="!text-[17px] !w-[17px] !h-[17px]">download</mat-icon>
                    <span>{{ i18n.t('social.downloadPng') }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    }
  `,
})
export class SocialShareModal {
  protected readonly store = inject(WorkspaceStore);
  protected readonly i18n = inject(I18nService);

  protected readonly format = signal<SocialCardFormat>('post');
  protected readonly theme = signal<SocialCardTheme>('gradient');
  protected readonly messageKind = signal<SocialCardMessageKind>('days');
  protected readonly rendering = signal<boolean>(false);
  protected readonly busyAction = signal<boolean>(false);
  protected readonly feedbackNotice = signal<{ tone: 'success' | 'error'; text: string } | null>(null);

  private readonly canvasRef = viewChild<ElementRef<HTMLCanvasElement>>('shareCanvas');
  private renderToken = 0;

  protected readonly canNativeShare = computed(() => {
    return typeof navigator !== 'undefined' && typeof navigator.share === 'function';
  });

  constructor() {
    effect(() => {
      const enriched = this.store.socialShareGoal();
      const canvasEl = this.canvasRef()?.nativeElement;
      const fmt = this.format();
      const th = this.theme();
      const msgKind = this.messageKind();
      const lang = this.i18n.lang();
      const brand = this.i18n.formatShowcaseBrand(this.store.showcaseOwnerName());

      if (!enriched || !canvasEl || !lang) return;

      const token = ++this.renderToken;
      this.rendering.set(true);
      const appUrl = resolveShareAppUrl();

      void renderSocialShareCard(
        canvasEl,
        enriched,
        {
          format: fmt,
          theme: th,
          messageKind: msgKind,
          brandTitle: brand,
          appUrl,
          iconUrl: '/icons/pwa-192x192.png',
        },
        {
          statusTag: this.i18n.t(getCardStatusTagKey(enriched.metrics.scenario)),
          daysUnit: this.i18n.t('social.daysUnit'),
          dayUnit: this.i18n.t('social.dayUnit'),
          yearsLabel: this.i18n.t('showcase.colYTitle').toUpperCase(),
          monthsLabel: this.i18n.t('showcase.colMTitle').toUpperCase(),
          weeksLabel: this.i18n.t('showcase.colWTitle').toUpperCase(),
          daysLabel: this.i18n.t('showcase.colDays').toUpperCase(),
          scanQrCaption: this.i18n.t('social.scanQr'),
          startDateLabel: this.i18n.t('showcase.colStart'),
        },
      ).finally(() => {
        if (token === this.renderToken) {
          this.rendering.set(false);
        }
      });
    });
  }

  protected onEscape(): void {
    if (this.store.socialShareGoal()) {
      this.close();
    }
  }

  protected close(): void {
    this.feedbackNotice.set(null);
    this.store.closeSocialShare();
  }

  private canvasToPngBlob(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const canvas = this.canvasRef()?.nativeElement;
      if (!canvas) {
        resolve(null);
        return;
      }
      canvas.toBlob((blob) => resolve(blob), 'image/png', 1.0);
    });
  }

  protected async copyImageToClipboard(): Promise<void> {
    if (this.busyAction()) return;
    this.busyAction.set(true);
    this.feedbackNotice.set(null);
    try {
      const blob = await this.canvasToPngBlob();
      if (
        !blob ||
        typeof navigator === 'undefined' ||
        !navigator.clipboard ||
        typeof ClipboardItem === 'undefined'
      ) {
        this.feedbackNotice.set({ tone: 'error', text: this.i18n.t('social.copyUnsupported') });
        return;
      }
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
      this.feedbackNotice.set({ tone: 'success', text: this.i18n.t('social.copiedImage') });
    } catch {
      this.feedbackNotice.set({ tone: 'error', text: this.i18n.t('social.copyUnsupported') });
    } finally {
      this.busyAction.set(false);
    }
  }

  protected async shareNative(): Promise<void> {
    const enriched = this.store.socialShareGoal();
    if (!enriched || this.busyAction()) return;
    this.busyAction.set(true);
    this.feedbackNotice.set(null);
    try {
      const blob = await this.canvasToPngBlob();
      if (!blob) return;
      const filename = buildSocialShareFilename(enriched.goal.title, this.format());
      const file = new File([blob], filename, { type: 'image/png' });
      const text =
        this.messageKind() === 'ymw'
          ? enriched.metrics.shareYmwMessage
          : enriched.metrics.shareDaysMessage;

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: enriched.goal.title,
          text,
          files: [file],
        });
      } else {
        await navigator.share({
          title: enriched.goal.title,
          text,
        });
      }
    } catch {
      // User dismissed share sheet — no error noise needed
    } finally {
      this.busyAction.set(false);
    }
  }

  protected async downloadPng(title: string): Promise<void> {
    if (this.busyAction()) return;
    this.busyAction.set(true);
    try {
      const blob = await this.canvasToPngBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = buildSocialShareFilename(title, this.format());
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      this.busyAction.set(false);
    }
  }
}
