import { Component, OnDestroy, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TranslateModule } from '@ngx-translate/core';
import { normalizeKzPhone, formatKzPhone } from '../../utils/phone';
import { apiErrorMessage } from '../../utils/http-error';
import { ResendCountdown } from '../../utils/resend-countdown';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  templateUrl: './forgot-password.component.html'
})
export class ForgotPasswordComponent implements OnDestroy {
  private authService = inject(AuthService);

  readonly codeLength = 6;

  /** 1 — ввод телефона, 2 — код и новый пароль, 3 — готово */
  readonly step = signal<1 | 2 | 3>(1);
  readonly isLoading = signal(false);
  readonly isResending = signal(false);
  /** Ключ перевода либо готовый текст ошибки от сервера. */
  readonly errorMessage = signal('');
  readonly infoMessage = signal('');
  readonly countdown = new ResendCountdown();

  phone = '';
  code = '';
  newPassword = '';
  confirmPassword = '';

  get displayPhone(): string {
    return formatKzPhone(this.phone);
  }

  onRequestCode() {
    this.errorMessage.set('');
    this.infoMessage.set('');
    const cleanPhone = normalizeKzPhone(this.phone);

    if (!cleanPhone) {
      this.errorMessage.set('ERRORS.PHONE_INVALID');
      return;
    }

    this.isLoading.set(true);
    this.phone = cleanPhone;

    this.authService.requestPasswordReset(cleanPhone).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.step.set(2);
        this.countdown.start(60);
      },
      error: (err) => {
        console.error('Ошибка запроса кода:', err);
        this.isLoading.set(false);
        if (err.status === 429) {
          // Код уже был отправлен меньше минуты назад и ещё действует — пускаем вводить его
          this.step.set(2);
          this.countdown.start(this.retryAfterSeconds(err));
          this.infoMessage.set(apiErrorMessage(err, 'OTP.ERR_SEND'));
          return;
        }
        // «Пользователь не найден», «Не удалось отправить сообщение в WhatsApp…» и т.п.
        this.errorMessage.set(apiErrorMessage(err, 'OTP.ERR_SEND'));
      }
    });
  }

  onResend() {
    if (this.countdown.seconds() > 0 || this.isLoading() || this.isResending()) return;

    this.isResending.set(true);
    this.errorMessage.set('');
    this.infoMessage.set('');

    this.authService.requestPasswordReset(this.phone).subscribe({
      next: () => {
        this.isResending.set(false);
        this.infoMessage.set('OTP.CODE_RESENT');
        this.countdown.start(60);
      },
      error: (err) => {
        this.isResending.set(false);
        this.errorMessage.set(apiErrorMessage(err, 'OTP.ERR_SEND'));
        if (err.status === 429) {
          this.countdown.start(this.retryAfterSeconds(err));
        }
      }
    });
  }

  onCodeInput() {
    this.code = (this.code || '').replace(/\D/g, '').slice(0, this.codeLength);
  }

  onResetPassword() {
    this.errorMessage.set('');
    this.infoMessage.set('');

    if (this.code.length !== this.codeLength) {
      this.errorMessage.set('FORGOT.ERR_CODE');
      return;
    }
    if (this.newPassword.length < 6) {
      this.errorMessage.set('FORGOT.ERR_PW_SHORT');
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage.set('ERRORS.PW_MISMATCH');
      return;
    }

    this.isLoading.set(true);
    this.authService.resetPassword({
      phone: this.phone,
      code: this.code,
      newPassword: this.newPassword
    }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.countdown.stop();
        this.step.set(3);
      },
      error: (err) => {
        console.error('Ошибка сброса пароля:', err);
        this.isLoading.set(false);
        this.errorMessage.set(apiErrorMessage(err, 'OTP.ERR_VERIFY'));
      }
    });
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
