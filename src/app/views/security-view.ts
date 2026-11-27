import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { generateTotpCode } from '../../core/domain/services/totp';
import { WorkspaceStore } from '../../core/main/workspace-store';
import { I18nService } from '../services/i18n';

@Component({
  selector: 'app-security-view',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule],
  template: `
    <div class="space-y-6 w-full">
      <!-- Account & Storage Status -->
      <section class="bg-white border border-[#DADCE0] rounded-xl p-6 space-y-4">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="space-y-1">
            <h2 class="font-display text-lg font-bold text-[#202124]">
              {{ i18n.t('security.accountTitle') }}
            </h2>
            <p class="text-sm text-[#5F6368]">
              {{ store.sessionUser()?.displayName }} · {{ store.sessionUser()?.email }}
            </p>
          </div>
          <div class="text-xs font-medium text-[#3C4043] font-mono">
            @if (store.sessionUser()?.mode === 'firebase') {
              <span class="text-[#137333]">{{ i18n.t('security.storageCloud') }}</span>
            } @else {
              <span class="text-[#9A5B00]">{{ i18n.t('security.storageDemo') }}</span>
            }
          </div>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-[#E8EAED] text-sm">
          <div>
            <p class="text-xs text-[#5F6368]">{{ i18n.t('security.providerLabel') }}</p>
            <p class="font-medium text-[#202124] mt-0.5">
              {{
                store.sessionUser()?.mode === 'firebase'
                  ? i18n.t('security.providerFirebase')
                  : i18n.t('security.providerDemo')
              }}
            </p>
          </div>
          <div>
            <p class="text-xs text-[#5F6368]">{{ i18n.t('security.emailVerifyLabel') }}</p>
            <p
              class="font-medium mt-0.5"
              [class]="store.sessionUser()?.emailVerified ? 'text-[#137333]' : 'text-[#A50E0E]'"
            >
              {{
                store.sessionUser()?.emailVerified
                  ? i18n.t('security.emailVerified')
                  : i18n.t('security.emailPending')
              }}
            </p>
          </div>
          <div>
            <p class="text-xs text-[#5F6368]">{{ i18n.t('security.mfaLabel') }}</p>
            <p
              class="font-medium mt-0.5"
              [class]="store.mfaConfig()?.totpEnabled ? 'text-[#137333]' : 'text-[#5F6368]'"
            >
              {{
                store.mfaConfig()?.totpEnabled
                  ? i18n.t('security.mfaActive')
                  : i18n.t('security.mfaInactive')
              }}
            </p>
          </div>
        </div>

        <!-- Personalize Display Name -->
        <div class="pt-4 border-t border-[#E8EAED] space-y-2">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <label for="account-display-name" class="text-xs font-semibold text-[#202124]">
              {{ i18n.t('security.displayNameLabel') }}
            </label>
            <span class="text-xs text-[#5F6368]">
              {{ i18n.t('security.currentHeaderLabel') }}
              <strong class="text-[#202124]">{{ i18n.formatShowcaseBrand(store.showcaseOwnerName()) }}</strong>
            </span>
          </div>

          <form [formGroup]="nameForm" (ngSubmit)="saveDisplayName()" class="flex flex-wrap items-center gap-2.5">
            <input
              id="account-display-name"
              type="text"
              formControlName="displayName"
              maxlength="50"
              [placeholder]="i18n.t('security.displayNamePlaceholder')"
              class="flex-1 min-w-[200px] max-w-xs px-3 py-2 rounded-lg border border-[#DADCE0] text-sm text-[#202124] focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:border-[#1A73E8]"
            />
            <button
              type="submit"
              [disabled]="nameForm.invalid || nameSaving()"
              class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
            >
              <mat-icon class="!text-[17px] !w-[17px] !h-[17px]">save</mat-icon>
              <span>{{ nameSaving() ? i18n.t('security.savingName') : i18n.t('security.saveName') }}</span>
            </button>
          </form>

          @if (nameError()) {
            <p role="alert" class="text-xs text-[#A50E0E]">{{ nameError() }}</p>
          }
        </div>
      </section>

      <!-- Standard AES-256-GCM Data Encryption (Opt-in, max 2 switches/month) -->
      <section
        class="bg-white border border-[#DADCE0] rounded-xl p-6 space-y-4"
        data-testid="encryption-section"
      >
        <div class="space-y-1">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h2 class="font-display text-lg font-bold text-[#202124]">
              {{ i18n.t('encryption.title') }}
            </h2>
            <span
              class="text-xs font-mono text-[#5F6368] tabular-nums"
              data-testid="encryption-quota"
            >
              {{
                i18n.t('encryption.quotaLabel', {
                  month: store.encryptionQuota().month,
                  used: store.encryptionQuota().used,
                  limit: store.encryptionQuota().limit,
                })
              }}
            </span>
          </div>
          <p class="text-sm text-[#5F6368] leading-relaxed">
            {{ i18n.t('encryption.subtitle') }}
          </p>
        </div>

        <div
          class="p-4 rounded-lg border flex flex-wrap items-center justify-between gap-4"
          [class]="
            store.encryptionEnabled()
              ? 'bg-[#E6F4EA] border-[#A8DAB5]'
              : 'bg-[#F8F9FA] border-[#E8EAED]'
          "
        >
          <div class="flex items-start gap-3 min-w-0 flex-1">
            <mat-icon
              class="mt-0.5 shrink-0"
              [class]="store.encryptionEnabled() ? 'text-[#137333]' : 'text-[#5F6368]'"
            >
              {{ store.encryptionEnabled() ? 'enhanced_encryption' : 'no_encryption_gmailerrorred' }}
            </mat-icon>
            <div class="space-y-1">
              <p
                class="text-sm font-semibold"
                [class]="store.encryptionEnabled() ? 'text-[#137333]' : 'text-[#202124]'"
                data-testid="encryption-status-label"
              >
                {{
                  store.encryptionEnabled()
                    ? i18n.t('encryption.statusActive')
                    : i18n.t('encryption.statusInactive')
                }}
              </p>
              <p class="text-xs text-[#5F6368] leading-relaxed">
                {{ i18n.t('encryption.scopeNote') }}
              </p>
            </div>
          </div>

          <button
            type="button"
            (click)="toggleEncryption()"
            [disabled]="store.encryptionBusy() || !store.encryptionQuota().canSwitch"
            data-testid="encryption-toggle-btn"
            [class]="
              store.encryptionEnabled()
                ? 'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border border-[#DADCE0] hover:bg-[#F8F9FA] text-sm font-medium text-[#202124] transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
                : 'inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed'
            "
          >
            @if (store.encryptionBusy()) {
              <mat-icon class="!text-[18px] !w-[18px] !h-[18px] animate-spin">progress_activity</mat-icon>
              <span>
                {{
                  store.encryptionEnabled()
                    ? i18n.t('encryption.busyDisable')
                    : i18n.t('encryption.busyEnable')
                }}
              </span>
            } @else {
              <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">
                {{ store.encryptionEnabled() ? 'lock_open' : 'lock' }}
              </mat-icon>
              <span>
                {{
                  store.encryptionEnabled()
                    ? i18n.t('encryption.disableBtn')
                    : i18n.t('encryption.enableBtn')
                }}
              </span>
            }
          </button>
        </div>

        @if (!store.encryptionQuota().canSwitch) {
          <p
            role="status"
            data-testid="encryption-quota-exhausted"
            class="text-xs text-[#9A5B00] bg-[#FEF7E0] border border-[#FDE293] rounded-lg px-3.5 py-2.5 leading-relaxed"
          >
            {{ i18n.t('encryption.quotaExhausted', { limit: store.encryptionQuota().limit }) }}
          </p>
        }

        @if (encryptionError()) {
          <p role="alert" class="text-xs text-[#A50E0E] font-medium">
            {{ encryptionError() }}
          </p>
        }

        <p class="text-xs text-[#5F6368] leading-relaxed pt-1 border-t border-[#F1F3F4]">
          {{ i18n.t('encryption.tierNote') }}
        </p>
      </section>

      <!-- 2FA / MFA TOTP Configuration Panel -->
      <section class="bg-white border border-[#DADCE0] rounded-xl p-6 space-y-5">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="space-y-1">
            <h2 class="font-display text-lg font-bold text-[#202124]">
              {{ i18n.t('security.mfaSectionTitle') }}
            </h2>
            <p class="text-sm text-[#5F6368]">
              {{ i18n.t('security.mfaSectionSubtitle') }}
            </p>
          </div>
        </div>

        @if (store.mfaConfig()?.totpEnabled && !store.pendingMfaDraft()) {
          <!-- Active 2FA State -->
          <div class="p-4 rounded-lg bg-[#E6F4EA] border border-[#A8DAB5] flex flex-wrap items-center justify-between gap-4">
            <div class="flex items-start gap-3">
              <mat-icon class="text-[#137333] mt-0.5">verified_user</mat-icon>
              <div>
                <p class="text-sm font-semibold text-[#137333]">
                  {{ i18n.t('security.mfaActiveBanner') }}
                </p>
                <p class="text-xs text-[#137333]/90 mt-0.5">
                  {{ i18n.t('security.mfaBackupRemaining') }}
                  <span class="font-mono font-semibold">{{ store.mfaConfig()?.backupCodeHashes?.length ?? 0 }}</span>
                </p>
              </div>
            </div>
            <div class="flex items-center gap-2">
              <button
                type="button"
                (click)="store.lockSessionForMfaTest()"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#DADCE0] text-xs font-semibold text-[#202124] hover:bg-[#F8F9FA] cursor-pointer"
              >
                <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">lock</mat-icon>
                <span>{{ i18n.t('security.mfaTestBtn') }}</span>
              </button>
              <button
                type="button"
                (click)="store.disableMfa()"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#F6AEA9] text-xs font-semibold text-[#A50E0E] hover:bg-[#FCE8E6] cursor-pointer"
              >
                <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">gpp_bad</mat-icon>
                <span>{{ i18n.t('security.mfaDisableBtn') }}</span>
              </button>
            </div>
          </div>
        } @else if (store.pendingMfaDraft(); as draft) {
          <!-- Enrollment Wizard -->
          <div class="space-y-5 pt-2 border-t border-[#E8EAED]">
            <div class="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
              <!-- QR Code Column -->
              <div class="md:col-span-5 flex flex-col items-center p-4 bg-[#F8F9FA] border border-[#DADCE0] rounded-xl space-y-3">
                @if (qrDataUrl()) {
                  <img
                    [src]="qrDataUrl()"
                    [alt]="i18n.t('security.mfaQrAlt')"
                    referrerpolicy="no-referrer"
                    class="w-44 h-44 rounded-lg border border-[#DADCE0] bg-white p-2"
                  />
                } @else {
                  <div class="w-44 h-44 rounded-lg bg-white border border-[#DADCE0] flex items-center justify-center text-xs text-[#5F6368]">
                    {{ i18n.t('security.mfaQrGenerating') }}
                  </div>
                }
                <div class="w-full text-center space-y-1">
                  <p class="text-xs text-[#5F6368]">{{ i18n.t('security.mfaSecretLabel') }}</p>
                  <p class="font-mono text-xs font-semibold text-[#202124] bg-white border border-[#DADCE0] rounded px-2 py-1.5 break-all select-all">
                    {{ draft.secret }}
                  </p>
                </div>
              </div>

              <!-- Verification & Backup Codes Column -->
              <div class="md:col-span-7 space-y-4">
                <div>
                  <h3 class="text-sm font-bold text-[#202124]">{{ i18n.t('security.mfaStep1Title') }}</h3>
                  <p class="text-xs text-[#5F6368] mt-0.5">
                    {{ i18n.t('security.mfaStep1Body') }}
                  </p>
                  <div class="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    @for (code of draft.backupCodes; track code) {
                      <div class="font-mono text-xs text-center py-1.5 px-2 rounded bg-[#F8F9FA] border border-[#DADCE0] text-[#202124] select-all">
                        {{ code }}
                      </div>
                    }
                  </div>
                </div>

                <div class="pt-2 border-t border-[#E8EAED] space-y-2.5">
                  <h3 class="text-sm font-bold text-[#202124]">{{ i18n.t('security.mfaStep2Title') }}</h3>

                  @if (store.sessionUser()?.mode === 'demo') {
                    <div class="flex flex-wrap items-center justify-between gap-2 p-2.5 rounded-lg bg-[#E8F0FE]/70 border border-[#AECBFA] text-xs text-[#174EA6]">
                      <span>{{ i18n.t('security.mfaDemoHint') }}</span>
                      <button
                        type="button"
                        (click)="fillDemoTotpCode(draft.secret)"
                        class="font-semibold underline cursor-pointer whitespace-nowrap"
                      >
                        {{ i18n.t('security.mfaDemoGenerate') }}
                      </button>
                    </div>
                  }

                  @if (enrollError()) {
                    <p role="alert" class="text-xs text-[#A50E0E] font-medium">{{ enrollError() }}</p>
                  }

                  <form [formGroup]="verifyForm" (ngSubmit)="confirmEnroll()" class="flex flex-wrap items-center gap-2.5">
                    <label for="enroll-totp" class="sr-only">{{ i18n.t('security.mfaCodeAria') }}</label>
                    <input
                      id="enroll-totp"
                      type="text"
                      formControlName="code"
                      maxlength="6"
                      placeholder="000000"
                      class="w-40 px-3.5 py-2 rounded-lg border border-[#DADCE0] font-mono text-base tracking-widest focus:outline-none focus:ring-2 focus:ring-[#1A73E8]"
                    />
                    <button
                      type="submit"
                      [disabled]="verifyForm.invalid"
                      class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-sm font-medium disabled:opacity-50 cursor-pointer"
                    >
                      <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">check_circle</mat-icon>
                      <span>{{ i18n.t('security.mfaActivateBtn') }}</span>
                    </button>
                    <button
                      type="button"
                      (click)="cancelEnroll()"
                      class="px-3.5 py-2 rounded-lg border border-[#DADCE0] text-sm font-medium text-[#5F6368] hover:bg-[#F8F9FA] cursor-pointer"
                    >
                      {{ i18n.t('common.cancel') }}
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        } @else {
          <!-- Not Enrolled State -->
          <div class="flex flex-wrap items-center justify-between gap-4 p-4 rounded-lg bg-[#F8F9FA] border border-[#E8EAED]">
            <p class="text-sm text-[#3C4043]">
              {{ i18n.t('security.mfaPromptBody') }}
            </p>
            <button
              type="button"
              (click)="startEnroll()"
              class="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">security</mat-icon>
              <span>{{ i18n.t('security.mfaEnableBtn') }}</span>
            </button>
          </div>
        }
      </section>

      <!-- Firebase Console Note for Email/Password -->
      <section class="bg-[#F8F9FA] border border-[#DADCE0] rounded-xl p-5 space-y-2 text-xs text-[#5F6368]">
        <h3 class="text-sm font-semibold text-[#202124]">
          {{ i18n.t('security.consoleNoteTitle') }}
        </h3>
        <p class="leading-relaxed">
          {{ i18n.t('security.consoleNoteBody') }}
        </p>
      </section>
    </div>
  `,
})
export class SecurityView {
  protected readonly store = inject(WorkspaceStore);
  protected readonly i18n = inject(I18nService);
  protected readonly qrDataUrl = signal<string | null>(null);
  protected readonly enrollError = signal<string | null>(null);
  protected readonly nameSaving = signal<boolean>(false);
  protected readonly nameError = signal<string | null>(null);
  protected readonly encryptionError = signal<string | null>(null);

  protected readonly nameForm = new FormGroup({
    displayName: new FormControl(
      this.store.profile().displayName || this.store.sessionUser()?.displayName || '',
      {
        nonNullable: true,
        validators: [Validators.required, Validators.minLength(2), Validators.maxLength(50)],
      },
    ),
  });

  protected readonly verifyForm = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^\d{6}$/)],
    }),
  });

  protected async toggleEncryption(): Promise<void> {
    this.encryptionError.set(null);
    const nextEnabled = !this.store.encryptionEnabled();
    const res = await this.store.setDataEncryptionEnabled(nextEnabled);
    if (!res.ok && res.error) {
      this.encryptionError.set(res.error);
    }
  }

  protected async saveDisplayName(): Promise<void> {
    if (this.nameForm.invalid || this.nameSaving()) return;
    this.nameError.set(null);
    this.nameSaving.set(true);
    try {
      const res = await this.store.updateDisplayName(this.nameForm.controls.displayName.value);
      if (!res.ok) {
        this.nameError.set(res.error ?? this.i18n.t('security.invalidName'));
      }
    } finally {
      this.nameSaving.set(false);
    }
  }

  protected async startEnroll(): Promise<void> {
    this.enrollError.set(null);
    this.verifyForm.reset({ code: '' });
    const draft = this.store.beginMfaEnrollment();
    try {
      const qrcodeMod = await import('qrcode');
      const toDataURL = qrcodeMod.toDataURL ?? qrcodeMod.default?.toDataURL;
      const dataUrl = await toDataURL(draft.otpAuthUri, {
        width: 220,
        margin: 1,
        color: { dark: '#202124', light: '#FFFFFF' },
      });
      this.qrDataUrl.set(dataUrl);
    } catch {
      this.qrDataUrl.set(null);
    }
  }

  protected cancelEnroll(): void {
    this.qrDataUrl.set(null);
    this.enrollError.set(null);
    this.store.cancelMfaEnrollment();
  }

  protected async fillDemoTotpCode(secret: string): Promise<void> {
    if (this.store.sessionUser()?.mode !== 'demo') return;
    const code = await generateTotpCode(secret, Date.now());
    this.verifyForm.setValue({ code });
  }

  protected async confirmEnroll(): Promise<void> {
    if (this.verifyForm.invalid) return;
    this.enrollError.set(null);
    const res = await this.store.confirmMfaEnrollment(this.verifyForm.getRawValue().code);
    if (!res.ok) {
      this.enrollError.set(res.error ?? this.i18n.t('security.mfaInvalidCode'));
      return;
    }
    this.qrDataUrl.set(null);
    this.verifyForm.reset({ code: '' });
  }
}
