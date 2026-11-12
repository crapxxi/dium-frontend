import { Component, OnDestroy, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { PendingTwoFactor, TwoFactorCodeType, TwoFactorMethod } from '../../models/api.models';
import { apiErrorMessage } from '../../utils/http-error';
import { formatKzPhone } from '../../utils/phone';
import { ResendCountdown } from '../../utils/resend-countdown';

/**
 * Второй шаг входа: пароль уже принят, но JWT выдаётся только после верного кода
 * (WhatsApp, приложение-аутентификатор или резервный код).
 */
@Component({
  selector: 'app-two-factor-verify',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './two-factor-verify.component.html'
})
export class TwoFactorVerifyComponent implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);

  readonly codeLength = 6;

  readonly pending = signal<PendingTwoFactor | null>(null);
  /** Чем пользователь подтверждает вход прямо сейчас. */
  readonly mode = signal<TwoFactorCodeType>('WHATSAPP');
  readonly code = signal('');
  readonly isLoading = signal(false);
  readonly isSending = signal(false);
  /** Ключ перевода либо готовый текст ошибки от сервера. */
  readonly errorMessage = signal('');
  readonly infoMessage = signal('');
  /** Был ли WhatsApp-код реально отправлен в рамках этого входа. */
  readonly whatsappSent = signal(false);
  readonly countdown = new ResendCountdown();

  readonly displayPhone = computed(() => formatKzPhone(this.pending()?.phone));
  readonly isBackupMode = computed(() => this.mode() === 'BACKUP_CODE');
  readonly canSwitchMethod = computed(() => (this.pending()?.availableMethods.length ?? 0) > 1);
  readonly canSubmit = computed(() => {
    const value = this.code();
    return this.isBackupMode()
      ? value.replace(/[^A-Za-z0-9]/g, '').length >= 10
      : value.length === this.codeLength;
  });

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) return;

    const pending = this.authService.getPendingTwoFactor();
    if (!pending) {
      // Нет незавершённого входа (или временный токен истёк) — начинаем с пароля
      this.router.navigate(['/login']);
      return;
    }

    this.pending.set(pending);
    this.mode.set(pending.method);

    if (pending.method === 'WHATSAPP') {
      if (pending.codeSent) {
        this.whatsappSent.set(true);
        this.countdown.start(60);
      } else {
        // Бэкенд не смог отправить код при входе — говорим об этом прямо
        this.errorMessage.set('TWO_FA.CODE_NOT_SENT');
      }
    }
  }

  onCodeInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const value = this.isBackupMode()
      ? input.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 11)
      : input.value.replace(/\D/g, '').slice(0, this.codeLength);
    input.value = value;
    this.code.set(value);
    this.errorMessage.set('');
  }

  selectMethod(method: TwoFactorMethod) {
    if (this.mode() === method) return;
    this.mode.set(method);
    this.resetInput();
  }

  toggleBackupCode() {
    this.mode.set(this.isBackupMode() ? (this.pending()?.method ?? 'WHATSAPP') : 'BACKUP_CODE');
    this.resetInput();
  }

  private resetInput() {
    this.code.set('');
    this.errorMessage.set('');
    this.infoMessage.set('');
  }

  /** Отправить или повторно отправить код в WhatsApp. */
  sendWhatsAppCode() {
    if (this.countdown.seconds() > 0 || this.isSending() || this.isLoading()) return;

    this.isSending.set(true);
    this.errorMessage.set('');
    this.infoMessage.set('');

    this.authService.sendTwoFactorLoginCode().subscribe({
      next: () => {
        this.isSending.set(false);
        this.whatsappSent.set(true);
        this.infoMessage.set('OTP.CODE_RESENT');
        this.countdown.start(60);
      },
      error: (err) => {
        this.isSending.set(false);
        this.errorMessage.set(apiErrorMessage(err, 'OTP.ERR_SEND'));
        if (err.status === 429) {
          // код уже отправлен и ещё действует
          this.whatsappSent.set(true);
          this.countdown.start(this.retryAfterSeconds(err));
        }
      }
    });
  }

  onSubmit() {
    if (!this.canSubmit() || this.isLoading()) return;

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.infoMessage.set('');

    this.authService.verifyTwoFactor(this.code().trim(), this.mode()).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/venues']);
      },
      error: (err) => {
        this.isLoading.set(false);
        if (err.status === 401) {
          // Временный токен истёк (5 минут) — нужно снова ввести пароль
          this.authService.clearPendingTwoFactor();
          this.router.navigate(['/login']);
          return;
        }
        this.code.set('');
        this.errorMessage.set(apiErrorMessage(err, 'TWO_FA.ERR_INVALID'));
      }
    });
  }

  cancel() {
    this.authService.clearPendingTwoFactor();
    this.router.navigate(['/login']);
  }

  /** Сервер сообщает, сколько осталось ждать, в тексте ошибки («…через 42 сек.»). */
  private retryAfterSeconds(err: any): number {
    const match = /(\d+)\s*сек/.exec(err?.error?.message || '');
    const seconds = match ? parseInt(match[1], 10) : 60;
    return Math.min(Math.max(seconds, 1), 60);
  }

  ngOnDestroy() {
    this.countdown.stop();
  }
}
