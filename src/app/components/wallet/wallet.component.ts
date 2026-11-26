import { Component, OnInit, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { AuthService } from '../../services/auth.service';
import { WalletService } from '../../services/wallet.service';
import { Wallet } from '../../models/api.models';
import { apiErrorMessage } from '../../utils/http-error';

/** Мои баллы: баланс, как их заработать и потратить, история операций. */
@Component({
  selector: 'app-wallet',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './wallet.component.html',
})
export class WalletComponent implements OnInit {
  private walletService = inject(WalletService);
  private authService = inject(AuthService);
  private platformId = inject(PLATFORM_ID);

  readonly user = toSignal(this.authService.currentUser$, { initialValue: this.authService.currentUserValue });
  readonly wallet = signal<Wallet | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal('');

  ngOnInit() {
    // На сервере токена нет: запрос ушёл бы без авторизации
    if (!isPlatformBrowser(this.platformId) || !this.authService.isLoggedIn()) {
      this.loading.set(false);
      return;
    }
    this.refresh();
  }

  refresh() {
    this.loading.set(true);
    this.walletService.getMyWallet().subscribe({
      next: (wallet) => {
        this.wallet.set(wallet);
        this.errorMessage.set('');
        this.loading.set(false);
      },
      error: (err) => {
        this.errorMessage.set(apiErrorMessage(err, 'ERRORS.SERVER'));
        this.loading.set(false);
      },
    });
  }
}
