import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppLanguage } from '../../core/i18n';
import { I18nService } from '../services/i18n';

@Component({
  selector: 'app-language-switcher',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      role="group"
      [attr.aria-label]="i18n.t('lang.selectorAria')"
      class="inline-flex items-center rounded-lg border border-[#E8EAED] bg-[#F8F9FA] p-0.5 text-[11px] font-semibold shrink-0"
    >
      @for (code of i18n.languages; track code) {
        <button
          type="button"
          (click)="select(code)"
          [attr.aria-pressed]="i18n.lang() === code"
          [title]="i18n.labels[code].nativeName"
          [class]="
            i18n.lang() === code
              ? 'px-2 py-0.5 rounded-md bg-white text-[#1A73E8] shadow-2xs transition-colors cursor-pointer'
              : 'px-2 py-0.5 rounded-md text-[#5F6368] hover:text-[#202124] transition-colors cursor-pointer'
          "
        >
          {{ i18n.labels[code].code }}
        </button>
      }
    </div>
  `,
})
export class LanguageSwitcher {
  protected readonly i18n = inject(I18nService);

  protected select(code: AppLanguage): void {
    this.i18n.setLanguage(code);
  }
}
