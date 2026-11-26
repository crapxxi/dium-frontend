import { Component, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { WalletService } from '../../services/wallet.service';
import { AdminWallet, SettlementReport } from '../../models/api.models';
import { apiErrorMessage } from '../../utils/http-error';

/** Админка баллов: кошелёк пользователя, ручная правка с причиной и сверка с заведениями. */
@Component({
  selector: 'app-admin-wallets',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  templateUrl: './admin-wallets.component.html',
})
export class AdminWalletsComponent implements OnInit {
  private walletService = inject(WalletService);
  private authService = inject(AuthService);
  private platformId = inject(PLATFORM_ID);

  private readonly user = toSignal(this.authService.currentUser$, { initialValue: this.authService.currentUserValue });
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');

  phone = '';
  amount: number | null = null;
  reason = '';
  from = firstDayOfMonth();
  to = today();

  readonly wallet = signal<AdminWallet | null>(null);
  readonly report = signal<SettlementReport | null>(null);
  readonly busy = signal(false);
  readonly errorMessage = signal('');
  readonly infoMessage = signal('');

  ngOnInit() {
    if (isPlatformBrowser(this.platformId) && this.isAdmin()) {
      this.loadSettlements();
    }
  }

  find() {
    if (!this.phone.trim()) return;
    this.clearMessages();
    this.busy.set(true);
    this.walletService.findByPhone(this.phone.trim()).subscribe({
      next: (wallet) => this.done(() => this.wallet.set(wallet)),
      error: (err) => this.fail(err, () => this.wallet.set(null)),
    });
  }

  adjust() {
    const wallet = this.wallet();
    if (!wallet || !this.amount || !this.reason.trim()) return;
    this.clearMessages();
    this.busy.set(true);
    this.walletService.adjust(wallet.userId, this.amount, this.reason.trim()).subscribe({
      next: (updated) =>
        this.done(() => {
          this.wallet.set(updated);
          this.amount = null;
          this.reason = '';
          this.infoMessage.set('ADMIN_WALLET.MSG_DONE');
        }),
      error: (err) => this.fail(err),
    });
  }

  loadSettlements() {
    this.clearMessages();
    this.walletService.getSettlements(this.from, this.to).subscribe({
      next: (report) => this.report.set(report),
      error: (err) => this.errorMessage.set(apiErrorMessage(err, 'ERRORS.SERVER')),
    });
  }

  private done(apply: () => void) {
    apply();
    this.busy.set(false);
  }

  private fail(err: unknown, apply?: () => void) {
    apply?.();
    this.errorMessage.set(apiErrorMessage(err, 'ERRORS.SERVER'));
    this.busy.set(false);
  }

  private clearMessages() {
    this.errorMessage.set('');
    this.infoMessage.set('');
  }
}

function today(): string {
  return isoDate(new Date());
}

function firstDayOfMonth(): string {
  const now = new Date();
  return isoDate(new Date(now.getFullYear(), now.getMonth(), 1));
}

function isoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
