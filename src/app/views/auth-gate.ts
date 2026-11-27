import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { WorkspaceStore } from '../../core/main/workspace-store';
import { LanguageSwitcher } from '../components/language-switcher';
import { I18nService } from '../services/i18n';

@Component({
  selector: 'app-auth-gate',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, MatIconModule, LanguageSwitcher],
  host: {
    '(window:focus)': 'onWindowFocus()',
  },
  template: `
    <div class="min-h-screen bg-[#F8F9FA] text-[#202124] flex flex-col">
      <!-- Consistent Top Bar: Logo (left -> Landing) + single "App" active item -->
      <header class="w-full bg-white border-b border-[#E8EAED]">
        <div class="max-w-6xl mx-auto h-16 px-6 sm:px-10 flex items-center justify-between gap-8">
          <button
            type="button"
            (click)="store.openLanding()"
            aria-label="CronoSheet — Torna alla Landing Page"
            class="inline-flex items-center gap-2.5 whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#1A73E8] rounded-lg"
          >
            <img
              src="/icons/pwa-192x192.png"
              alt=""
              referrerpolicy="no-referrer"
              class="w-8 h-8 rounded-lg shrink-0"
            />
            <span class="font-display font-bold text-lg tracking-tight text-[#202124]">CronoSheet</span>
          </button>

          <nav aria-label="Navigazione principale" class="flex items-center gap-3 sm:gap-4 shrink-0">
            <app-language-switcher />
            <span
              aria-current="page"
              class="inline-flex items-center px-3 py-2 text-[15px] font-semibold text-[#1A73E8] border-b-2 border-[#1A73E8] whitespace-nowrap shrink-0"
            >
              {{ i18n.t('landing.navApp') }}
            </span>
          </nav>
        </div>
      </header>

      <!-- Main Split Content -->
      <main class="flex-1 flex items-center justify-center px-6 py-10">
        <div class="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          <!-- Left Editorial Column -->
          <section class="lg:col-span-6 space-y-6">
            <div class="space-y-3">
              <p class="text-sm font-medium text-[#1A73E8]">
                {{ i18n.t('auth.eyebrow') }}
              </p>
              <h1
                class="font-display text-3xl sm:text-4xl font-bold tracking-tight text-[#202124] leading-tight"
                style="text-wrap: balance;"
              >
                {{ i18n.t('auth.heroTitle') }}
              </h1>
              <p class="text-[15px] text-[#5F6368] leading-relaxed max-w-xl">
                {{ i18n.t('auth.heroSubtitle') }}
              </p>
            </div>

            <div class="divide-y divide-[#E8EAED] border-t border-b border-[#E8EAED]">
              <div class="py-3.5 flex items-start gap-3">
                <span class="w-2.5 h-2.5 rounded-sm bg-[#1A73E8] mt-1.5 shrink-0" aria-hidden="true"></span>
                <div>
                  <h2 class="text-sm font-semibold text-[#202124]">Algoritmo di calendario esatto</h2>
                  <p class="text-sm text-[#5F6368]">
                    Gestisce anni bisestili, 28/29 febbraio e mesi da 30/31 giorni senza approssimazioni.
                  </p>
                </div>
              </div>
              <div class="py-3.5 flex items-start gap-3">
                <span class="w-2.5 h-2.5 rounded-sm bg-[#34A853] mt-1.5 shrink-0" aria-hidden="true"></span>
                <div>
                  <h2 class="text-sm font-semibold text-[#202124]">Scansione automatica Recurrences</h2>
                  <p class="text-sm text-[#5F6368]">
                    Intercetta anniversari, mesiversari, settimaniversari e traguardi tondi entro la tua soglia di giorni.
                  </p>
                </div>
              </div>
              <div class="py-3.5 flex items-start gap-3">
                <span class="w-2.5 h-2.5 rounded-sm bg-[#EA4335] mt-1.5 shrink-0" aria-hidden="true"></span>
                <div>
                  <h2 class="text-sm font-semibold text-[#202124]">Database privato &amp; 2FA TOTP (RFC 6238)</h2>
                  <p class="text-sm text-[#5F6368]">
                    Ogni utente accede solo ai propri dati su Firestore, con supporto a Google Authenticator e codici di recupero.
                  </p>
                </div>
              </div>
            </div>
          </section>

          <!-- Right Auth Card -->
          <section class="lg:col-span-6">
            <div class="bg-white border border-[#DADCE0] rounded-xl p-6 sm:p-8 shadow-sm">
              @if (store.authStage() === 'email_verification_required') {
                <!-- Email Verification Required Gate -->
                <div class="space-y-5">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center shrink-0">
                      <mat-icon>mark_email_unread</mat-icon>
                    </div>
                    <div class="min-w-0">
                      <h2 class="font-display text-xl font-bold text-[#202124]">
                        Verifica la tua email
                      </h2>
                      <p class="text-sm text-[#5F6368] truncate">
                        {{ store.sessionUser()?.email }}
                      </p>
                    </div>
                  </div>

                  <p class="text-sm text-[#3C4043] leading-relaxed">
                    Per proteggere i tuoi dati su Cloud Firestore, l’accesso all’app si sblocca solo
                    dopo aver confermato il tuo indirizzo email. Apri il messaggio che ti abbiamo
                    inviato, clicca sul link di conferma e poi premi il pulsante qui sotto —
                    <strong>non serve rifare il login</strong>.
                  </p>

                  @if (store.authNotice()) {
                    <div
                      role="status"
                      class="p-3 rounded-lg bg-[#E8F0FE] border border-[#AECBFA] text-sm text-[#174EA6] flex items-start gap-2"
                    >
                      <mat-icon class="!text-[18px] !w-[18px] !h-[18px] mt-0.5 shrink-0">info</mat-icon>
                      <span>{{ store.authNotice() }}</span>
                    </div>
                  }

                  @if (store.authError()) {
                    <div
                      role="alert"
                      class="p-3 rounded-lg bg-[#FCE8E6] border border-[#F6AEA9] text-sm text-[#A50E0E] flex items-start gap-2"
                    >
                      <mat-icon class="!text-[18px] !w-[18px] !h-[18px] mt-0.5 shrink-0">error_outline</mat-icon>
                      <span>{{ store.authError() }}</span>
                    </div>
                  }

                  <div class="space-y-2.5 pt-1">
                    <button
                      type="button"
                      (click)="store.refreshEmailVerificationStatus(false)"
                      [disabled]="store.authBusy()"
                      class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#1A73E8] hover:bg-[#1557B0] text-white text-sm font-medium transition-colors disabled:opacity-60 cursor-pointer"
                    >
                      @if (store.authBusy()) {
                        <mat-icon class="!text-[18px] !w-[18px] !h-[18px] animate-spin">progress_activity</mat-icon>
                        <span>Verifica in corso…</span>
                      } @else {
                        <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">check_circle</mat-icon>
                        <span>Ho verificato l’email — Entra ora</span>
                      }
                    </button>

                    <div class="flex items-center gap-2.5">
                      <button
                        type="button"
                        (click)="store.resendVerificationEmail()"
                        [disabled]="store.authBusy()"
                        class="flex-1 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg border border-[#DADCE0] bg-white hover:bg-[#F8F9FA] text-xs font-medium text-[#3C4043] transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        <mat-icon class="!text-[16px] !w-[16px] !h-[16px]">send</mat-icon>
                        <span>Invia di nuovo</span>
                      </button>

                      <button
                        type="button"
                        (click)="store.logout()"
                        [disabled]="store.authBusy()"
                        class="px-3.5 py-2 rounded-lg border border-[#DADCE0] bg-white hover:bg-[#F8F9FA] text-xs font-medium text-[#5F6368] transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        Cambia account
                      </button>
                    </div>
                  </div>
                </div>
              } @else if (store.authStage() === 'mfa_required') {
                <!-- 2FA Challenge Screen -->
                <div class="space-y-5">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-lg bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center shrink-0">
                      <mat-icon>verified_user</mat-icon>
                    </div>
                    <div>
                      <h2 class="font-display text-xl font-bold text-[#202124]">Verifica 2FA richiesta</h2>
                      <p class="text-sm text-[#5F6368]">
                        {{ store.sessionUser()?.email }}
                      </p>
                    </div>
                  </div>

                  <p class="text-sm text-[#5F6368] leading-relaxed">
                    Inserisci il codice a 6 cifre dalla tua app Authenticator (Google Authenticator / Authy)
                    oppure un codice di recupero monouso (<span class="font-mono">XXXX-XXXX</span>).
                  </p>

                  @if (store.authError()) {
                    <div
                      role="alert"
                      class="p-3 rounded-lg bg-[#FCE8E6] border border-[#F6AEA9] text-sm text-[#A50E0E] flex items-start gap-2"
                    >
                      <mat-icon class="!text-[18px] !w-[18px] !h-[18px] mt-0.5 shrink-0">error_outline</mat-icon>
                      <span>{{ store.authError() }}</span>
                    </div>
                  }

                  <form [formGroup]="mfaForm" (ngSubmit)="submitMfa()" class="space-y-4">
                    <div>
                      <label for="mfa-code" class="block text-sm font-medium text-[#202124] mb-1.5">
                        Codice 2FA o codice di recupero
                      </label>
                      <input
                        id="mfa-code"
                        type="text"
                        formControlName="code"
                        autocomplete="one-time-code"
                        placeholder="123456 oppure ABCD-EFGH"
                        class="w-full px-3.5 py-2.5 rounded-lg border border-[#DADCE0] font-mono text-base tracking-widest focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:border-[#1A73E8]"
                      />
                    </div>

                    <div class="flex items-center gap-3">
                      <button
                        type="submit"
                        [disabled]="mfaForm.invalid"
                        class="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#1A73E8] text-white text-sm font-medium hover:bg-[#1557B0] disabled:opacity-50 transition-colors cursor-pointer"
                      >
                        <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">lock_open</mat-icon>
                        <span>Verifica e sblocca</span>
                      </button>
                      <button
                        type="button"
                        (click)="store.logout()"
                        class="px-4 py-2.5 rounded-lg border border-[#DADCE0] text-sm font-medium text-[#5F6368] hover:bg-[#F8F9FA] transition-colors cursor-pointer"
                      >
                        Esci
                      </button>
                    </div>
                  </form>
                </div>
              } @else {
                <!-- Standard Login / Registration Screen -->
                <div class="space-y-5">
                  <div>
                    <h2 class="font-display text-xl font-bold text-[#202124]">{{ i18n.t('auth.signInTitle') }}</h2>
                    <p class="text-sm text-[#5F6368] mt-1">
                      {{ i18n.t('auth.signInSubtitle') }}
                    </p>
                  </div>

                  @if (store.authError()) {
                    <div
                      role="alert"
                      class="p-3 rounded-lg bg-[#FCE8E6] border border-[#F6AEA9] text-sm text-[#A50E0E] flex items-start gap-2"
                    >
                      <mat-icon class="!text-[18px] !w-[18px] !h-[18px] mt-0.5 shrink-0">error_outline</mat-icon>
                      <span>{{ store.authError() }}</span>
                    </div>
                  }

                  <!-- Primary Google Sign-In -->
                  <button
                    type="button"
                    (click)="store.signInWithGoogle()"
                    [disabled]="store.authBusy()"
                    class="w-full inline-flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-[#DADCE0] bg-white hover:bg-[#F8F9FA] text-sm font-medium text-[#202124] transition-colors disabled:opacity-60 cursor-pointer"
                  >
                    <svg class="w-5 h-5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
                      />
                      <path
                        fill="#FBBC04"
                        d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                      />
                    </svg>
                    <span>{{ i18n.t('auth.googleBtn') }}</span>
                  </button>

                  <div class="relative flex items-center py-1">
                    <div class="flex-grow border-t border-[#E8EAED]"></div>
                    <span class="px-3 text-xs text-[#5F6368]">{{ i18n.t('auth.orEmail') }}</span>
                    <div class="flex-grow border-t border-[#E8EAED]"></div>
                  </div>

                  <!-- Mode switcher -->
                  <div class="grid grid-cols-2 gap-1 p-1 bg-[#F1F3F4] rounded-lg" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      [attr.aria-selected]="authMode() === 'login'"
                      (click)="authMode.set('login')"
                      [class]="
                        authMode() === 'login'
                          ? 'py-1.5 text-xs font-semibold rounded-md bg-white text-[#202124] shadow-sm cursor-pointer'
                          : 'py-1.5 text-xs font-medium rounded-md text-[#5F6368] hover:text-[#202124] cursor-pointer'
                      "
                    >
                      {{ i18n.t('auth.tabLogin') }}
                    </button>
                    <button
                      type="button"
                      role="tab"
                      [attr.aria-selected]="authMode() === 'register'"
                      (click)="authMode.set('register')"
                      [class]="
                        authMode() === 'register'
                          ? 'py-1.5 text-xs font-semibold rounded-md bg-white text-[#202124] shadow-sm cursor-pointer'
                          : 'py-1.5 text-xs font-medium rounded-md text-[#5F6368] hover:text-[#202124] cursor-pointer'
                      "
                    >
                      {{ i18n.t('auth.tabRegister') }}
                    </button>
                  </div>

                  <form [formGroup]="credentialsForm" (ngSubmit)="submitCredentials()" class="space-y-3.5">
                    @if (authMode() === 'register') {
                      <div>
                        <label for="auth-name" class="block text-xs font-medium text-[#202124] mb-1">
                          Il tuo nome <span class="text-[#C5221F]">*</span>
                        </label>
                        <input
                          id="auth-name"
                          type="text"
                          formControlName="displayName"
                          autocomplete="given-name"
                          maxlength="50"
                          placeholder="Es. Orso"
                          class="w-full px-3 py-2 rounded-lg border border-[#DADCE0] text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:border-[#1A73E8]"
                        />
                        <p class="mt-1 text-[11px] text-[#5F6368]">
                          Personalizza la tua vista principale (es. «CronoSheet di Orso»).
                        </p>
                      </div>
                    }

                    <div>
                      <label for="auth-email" class="block text-xs font-medium text-[#202124] mb-1">
                        Email
                      </label>
                      <input
                        id="auth-email"
                        type="email"
                        formControlName="email"
                        autocomplete="email"
                        placeholder="nome@esempio.it"
                        class="w-full px-3 py-2 rounded-lg border border-[#DADCE0] text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:border-[#1A73E8]"
                      />
                    </div>

                    <div>
                      <label for="auth-password" class="block text-xs font-medium text-[#202124] mb-1">
                        Password
                      </label>
                      <input
                        id="auth-password"
                        type="password"
                        formControlName="password"
                        [attr.autocomplete]="authMode() === 'login' ? 'current-password' : 'new-password'"
                        placeholder="Minimo 6 caratteri"
                        class="w-full px-3 py-2 rounded-lg border border-[#DADCE0] text-sm focus:outline-none focus:ring-2 focus:ring-[#1A73E8] focus:border-[#1A73E8]"
                      />
                    </div>

                    <button
                      type="submit"
                      [disabled]="isCredentialsSubmitDisabled()"
                      class="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#202124] hover:bg-[#3C4043] text-white text-sm font-medium transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      <mat-icon class="!text-[18px] !w-[18px] !h-[18px]">
                        {{ authMode() === 'login' ? 'login' : 'person_add' }}
                      </mat-icon>
                      <span>{{ authMode() === 'login' ? i18n.t('auth.submitLogin') : i18n.t('auth.submitRegister') }}</span>
                    </button>
                  </form>

                  <div class="pt-3 border-t border-[#E8EAED] flex items-center justify-between gap-3">
                    <span class="text-xs text-[#5F6368]">{{ i18n.t('auth.demoPrompt') }}</span>
                    <button
                      type="button"
                      (click)="enterDemo()"
                      class="text-xs font-semibold text-[#1A73E8] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      {{ i18n.t('auth.demoBtn') }}
                    </button>
                  </div>
                </div>
              }
            </div>
          </section>
        </div>
      </main>
    </div>
  `,
})
export class AuthGate {
  protected readonly store = inject(WorkspaceStore);
  protected readonly i18n = inject(I18nService);
  protected readonly authMode = signal<'login' | 'register'>('login');

  protected readonly credentialsForm = new FormGroup({
    displayName: new FormControl('', { nonNullable: true }),
    email: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.email],
    }),
    password: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
  });

  protected readonly mfaForm = new FormGroup({
    code: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(6)],
    }),
  });

  protected isCredentialsSubmitDisabled(): boolean {
    if (this.store.authBusy() || this.credentialsForm.invalid) return true;
    if (this.authMode() === 'register') {
      return this.credentialsForm.controls.displayName.value.trim().length < 2;
    }
    return false;
  }

  protected onWindowFocus(): void {
    if (this.store.authStage() === 'email_verification_required' && !this.store.authBusy()) {
      void this.store.refreshEmailVerificationStatus(true);
    }
  }

  protected async submitCredentials(): Promise<void> {
    if (this.isCredentialsSubmitDisabled()) return;
    const { displayName, email, password } = this.credentialsForm.getRawValue();
    if (this.authMode() === 'login') {
      await this.store.signInWithEmailPassword(email, password);
    } else {
      await this.store.registerWithEmailPassword(displayName, email, password);
    }
  }

  protected async submitMfa(): Promise<void> {
    if (this.mfaForm.invalid) return;
    await this.store.submitMfaChallenge(this.mfaForm.getRawValue().code);
  }

  protected enterDemo(): void {
    void this.store.enterDemoMode();
  }
}
