import { Component, OnInit, OnDestroy, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { apiErrorMessage } from '../../utils/http-error';
import { formatKzPhone } from '../../utils/phone';
import { ResendCountdown } from '../../utils/resend-countdown';

@Component({
  selector: 'app-activate',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './activate.component.html'
})
export class ActivateComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);

  readonly codeLength = 6;

  phone = '';
  readonly code = signal('');
  readonly isLoading = signal(false);
  readonly isResending = signal(false);
  /** Ключ перевода либо готовый текст ошибки от сервера. */
  readonly errorMessage = signal('');
  readonly infoMessage = signal('');
  readonly countdown = new ResendCountdown();

  get displayPhone(): string {
    return formatKzPhone(this.phone);
  }

  ngOnInit() {
    this.phone = this.route.snapshot.queryParams['phone'];

    if (!this.phone) {
      this.router.navigate(['/login']);
      return;
    }

    // Сюда попадают сразу после отправки кода (регистрация / вход в неподтверждённый аккаунт)
    this.countdown.start(60);
  }

  onCodeInput(event: Event) {
    const input = event.target as HTMLInputElement;
    const digits = input.value.replace(/\D/g, '').slice(0, this.codeLength);
    input.value = digits;
    this.code.set(digits);
    this.errorMessage.set('');
  }

  onActivate() {
    if (this.code().length !== this.codeLength || this.isLoading()) return;

    this.isLoading.set(true);
    this.errorMessage.set('');
    this.infoMessage.set('');

    this.authService.activateAccount(this.phone, this.code()).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/venues']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(apiErrorMessage(err, 'OTP.ERR_VERIFY'));
      }
    });
  }

  onResend() {
    if (this.countdown.seconds() > 0 || this.isLoading() || this.isResending()) return;

    this.isResending.set(true);
    this.errorMessage.set('');
    this.infoMessage.set('');

    this.authService.resendCode(this.phone).subscribe({
      next: () => {
        this.isResending.set(false);
        this.infoMessage.set('OTP.CODE_RESENT');
        this.countdown.start(60);
      },
      error: (err) => {
        this.isResending.set(false);
        // Например: «Не удалось отправить сообщение в WhatsApp…» или «Повторная отправка возможна через N сек.»
        this.errorMessage.set(apiErrorMessage(err, 'OTP.ERR_SEND'));
        if (err.status === 429) {
          this.countdown.start(this.retryAfterSeconds(err));
        }
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
