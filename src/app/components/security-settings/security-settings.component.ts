import { Component, OnDestroy, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import {
  TwoFactorCodeType,
  TwoFactorMethod,
  TwoFactorSetupResponse,
  TwoFactorStatus,
} from '../../models/api.models';
import { apiErrorMessage } from '../../utils/http-error';
import { ResendCountdown } from '../../utils/resend-countdown';

type View = 'loading' | 'overview' | 'setup' | 'backup-codes' | 'disable' | 'regenerate';

/**
 * Раздел «Безопасность» в профиле: включение/отключение 2FA, QR-код для приложения-аутентификатора,
 * резервные коды (показываются один раз).
 */
@Component({
  selector: 'app-security-settings',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './security-settings.component.html'
})
export class SecuritySettingsComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private platformId = inject(PLATFORM_ID);

  readonly codeLength = 6;

  readonly view = signal<View>('loading');
  readonly status = signal<TwoFactorStatus | null>(null);
  readonly loadFailed = signal(false);

  /** Данные текущей настройки (секрет и QR для TOTP). */
  readonly setup = signal<TwoFactorSetupResponse | null>(null);
  readonly backupCodes = signal<string[]>([]);

  readonly code = signal('');
  readonly password = signal('');
  readonly useBackupCode = signal(false);

  readonly busy = signal(false);
  readonly isSending = signal(false);
  readonly codeSent = signal(false);
  readonly copied = signal(false);
  readonly secretCopied = signal(false);
  /** Ключ перевода либо готовый текст ошибки от сервера. */
  readonly errorMessage = signal('');
  readonly infoMessage = signal('');
  readonly countdown = new ResendCountdown();

  /** Способ, которым сейчас подтверждается вход (для отключения нужен код именно этого способа). */
  readonly currentMethod = computed<TwoFactorMethod>(() => this.status()?.method ?? 'WHATSAPP');
  /** Другой способ, на который можно переключиться. */
  readonly otherMethod = computed<TwoFactorMethod>(() => (this.currentMethod() === 'TOTP' ? 'WHATSAPP' : 'TOTP'));

  readonly codeReady = computed(() => this.code().length === this.codeLength);
  readonly disableCodeReady = computed(() =>
    this.useBackupCode()
      ? this.code().replace(/[^A-Za-z0-9]/g, '').length >= 10
      : this.code().length === this.codeLength,
  );

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.loadStatus();
    }
  }

  loadStatus() {
    this.loadFailed.set(false);
    this.authService.getTwoFactorStatus().subscribe({
      next: (status) => {
        this.status.set(status);
        if (this.view() === 'loading') this.view.set('overview');
      },
      error: () => {
        this.loadFailed.set(true);
        this.view.set('overview');
      }
    });
  }

  // ───────────────────────── ввод ─────────────────────────

  onCodeInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = this.useBackupCode()
      ? input.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11)
      : input.value.replace(/\D/g, '').slice(0, this.codeLength);
    input.value = value;
    this.code.set(value);
    this.errorMessage.set('');
  }

  onPasswordInput(event: Event) {
    this.password.set((event.target as HTMLInputElement).value);
    this.errorMessage.set('');
  }

  private resetForm() {
    this.code.set('');
    this.password.set('');
    this.useBackupCode.set(false);
    this.codeSent.set(false);
    this.errorMessage.set('');
    this.infoMessage.set('');
    this.countdown.stop();
  }

  backToOverview(info = '') {
    this.resetForm();
    this.setup.set(null);
    this.backupCodes.set([]);
    this.copied.set(false);
    this.infoMessage.set(info);
    this.view.set('overview');
    this.loadStatus();
  }

  // ───────────────────────── включение ─────────────────────────

  startSetup(method: TwoFactorMethod) {
    if (this.busy()) return;
    this.resetForm();
    this.busy.set(true);

    this.authService.setupTwoFactor(method).subscribe({
      next: (setup) => {
        this.busy.set(false);
        this.setup.set(setup);
        if (method === 'WHATSAPP') {
          this.codeSent.set(true);
          this.countdown.start(60);
        }
        this.view.set('setup');
      },
      error: (err) => {
        this.busy.set(false);
        // Например, WhatsApp-код не отправился — показываем причину и остаёмся на обзоре
        this.errorMessage.set(apiErrorMessage(err, 'SECURITY.ERR_GENERIC'));
      }
    });
  }

  /** Повторная отправка WhatsApp-кода во время настройки. */
  resendSetupCode() {
    if (this.countdown.seconds() > 0 || this.isSending()) return;
    this.isSending.set(true);
    this.errorMessage.set('');

    this.authService.setupTwoFactor('WHATSAPP').subscribe({
      next: () => {
        this.isSending.set(false);
        this.infoMessage.set('OTP.CODE_RESENT');
        this.countdown.start(60);
      },
      error: (err) => {
        this.isSending.set(false);
        this.errorMessage.set(apiErrorMessage(err, 'OTP.ERR_SEND'));
      }
    });
  }

  confirmEnable() {
    const setup = this.setup();
    if (!setup || !this.codeReady() || this.busy()) return;

    this.busy.set(true);
    this.errorMessage.set('');
    this.infoMessage.set('');

    this.authService.enableTwoFactor(setup.method, this.code()).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.resetForm();
        this.setup.set(null);
        this.backupCodes.set(res.backupCodes);
        this.view.set('backup-codes');
        this.loadStatus();
      },
      error: (err) => {
        this.busy.set(false);
        this.code.set('');
        this.errorMessage.set(apiErrorMessage(err, 'TWO_FA.ERR_INVALID'));
      }
    });
  }

  // ───────────────────────── резервные коды ─────────────────────────

  openRegenerate() {
    this.resetForm();
    this.view.set('regenerate');
  }

  confirmRegenerate() {
    if (!this.password() || this.busy()) return;

    this.busy.set(true);
    this.errorMessage.set('');

    this.authService.regenerateBackupCodes(this.password()).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.resetForm();
        this.backupCodes.set(res.backupCodes);
        this.view.set('backup-codes');
        this.loadStatus();
      },
      error: (err) => {
        this.busy.set(false);
        this.errorMessage.set(apiErrorMessage(err, 'SECURITY.ERR_GENERIC'));
      }
    });
  }

  private backupCodesText(): string {
    return this.backupCodes().join('\n');
  }

  copyBackupCodes() {
    this.copyText(this.backupCodesText(), this.copied);
  }

  copySecret() {
    const secret = this.setup()?.secret;
    if (secret) this.copyText(secret, this.secretCopied);
  }

  private copyText(text: string, flag: { set: (value: boolean) => void }) {
    if (!isPlatformBrowser(this.platformId)) return;

    const done = () => {
      flag.set(true);
      setTimeout(() => flag.set(false), 2500);
    };

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(done).catch(() => this.legacyCopy(text, done));
    } else {
      this.legacyCopy(text, done);
    }
  }

  /** Запасной вариант для браузеров/контекстов без Clipboard API (например, http). */
  private legacyCopy(text: string, done: () => void) {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    try {
      if (document.execCommand('copy')) done();
    } finally {
      document.body.removeChild(area);
    }
  }

  downloadBackupCodes() {
    if (!isPlatformBrowser(this.platformId)) return;

    const content = `DIUM — backup codes\n${new Date().toLocaleString()}\n\n${this.backupCodesText()}\n`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/plain;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'dium-backup-codes.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ───────────────────────── отключение ─────────────────────────

  openDisable() {
    this.resetForm();
    this.view.set('disable');
  }

  toggleDisableBackupCode() {
    this.useBackupCode.update((value) => !value);
    this.code.set('');
    this.errorMessage.set('');
  }

  /** WhatsApp-код для подтверждения отключения. */
  sendDisableCode() {
    if (this.countdown.seconds() > 0 || this.isSending()) return;
    this.isSending.set(true);
    this.errorMessage.set('');
    this.infoMessage.set('');

    this.authService.sendTwoFactorCode().subscribe({
      next: () => {
        this.isSending.set(false);
        this.codeSent.set(true);
        this.infoMessage.set('SECURITY.CODE_SENT');
        this.countdown.start(60);
      },
      error: (err) => {
        this.isSending.set(false);
        this.errorMessage.set(apiErrorMessage(err, 'OTP.ERR_SEND'));
      }
    });
  }

  confirmDisable() {
    if (!this.password() || !this.disableCodeReady() || this.busy()) return;

    const method: TwoFactorCodeType = this.useBackupCode() ? 'BACKUP_CODE' : this.currentMethod();

    this.busy.set(true);
    this.errorMessage.set('');
    this.infoMessage.set('');

    this.authService.disableTwoFactor(this.password(), this.code().trim(), method).subscribe({
      next: () => {
        this.busy.set(false);
        this.backToOverview('SECURITY.DISABLED_OK');
      },
      error: (err) => {
        this.busy.set(false);
        this.errorMessage.set(apiErrorMessage(err, 'SECURITY.ERR_GENERIC'));
      }
    });
  }

  ngOnDestroy() {
    this.countdown.stop();
  }
}
