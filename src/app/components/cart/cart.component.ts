import { Component, inject, ChangeDetectorRef, OnInit, OnDestroy, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms'; 
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { Subscription, combineLatest } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { FulfillmentType, PaymentMethod, Wallet } from '../../models/api.models';
import { WalletService, pointsPrice } from '../../services/wallet.service';


@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, TranslateModule], 
  templateUrl: './cart.component.html'
})
export class CartComponent implements OnInit, OnDestroy {
  public cartService = inject(CartService);
  public authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private walletService = inject(WalletService);
  private platformId = inject(PLATFORM_ID);

  public isSubmitting = false;
  /** Выбор покупателя: самовывоз или доставка (null — ещё не выбрал). Общий с карточкой товара. */
  public fulfillment: FulfillmentType | null = null;
  public isDelivery = false; 
  public address = '';       
  public orderComment = ''; 
  public paymentFrom = '';
  
  public canDeliver = false;
  private venueSub?: Subscription;
  private fulfillmentSub?: Subscription;
  private totalsSub?: Subscription;

  /** Kaspi или баллы. Баллами — дороже на наценку, зато без перевода. */
  public paymentMethod: PaymentMethod = 'KASPI';
  /** Кошелёк покупателя; null — ещё не загружен или не вошёл. */
  public wallet: Wallet | null = null;
  /** Цена заказа в баллах (с наценкой) и в тенге — для подсказки. */
  public pointsTotal = 0;
  public tengeTotal = 0;

  get notEnoughPoints(): number {
    return this.wallet ? Math.max(0, this.pointsTotal - this.wallet.balance) : 0;
  }

  ngOnInit() {
    this.fulfillmentSub = this.cartService.fulfillment$.subscribe(type => {
      this.fulfillment = type;
      this.isDelivery = type === 'DELIVERY';
      this.cdr.detectChanges();
    });

    this.venueSub = this.cartService.currentVenue$.subscribe(venue => {
      this.canDeliver = venue?.canDeliver ?? false;

      // Заведение не доставляет — остаётся только самовывоз
      if (venue && !this.canDeliver && this.fulfillment !== 'PICKUP') {
        this.toggleDelivery(false);
      }
      this.cdr.detectChanges();
    });

    this.totalsSub = combineLatest([this.cartService.productsTotal$, this.cartService.deliveryFee$]).subscribe(
      ([products, fee]) => {
        this.tengeTotal = products + fee;
        this.pointsTotal = pointsPrice(products, fee, this.wallet?.markupPercent ?? 20);
        this.cdr.detectChanges();
      });

    // Баланс нужен только в браузере и только вошедшему
    if (isPlatformBrowser(this.platformId) && this.authService.isLoggedIn()) {
      this.walletService.getMyWallet().subscribe({
        next: wallet => {
          this.wallet = wallet;
          this.recalcPoints();
        },
        error: () => this.wallet = null
      });
    }
  }

  ngOnDestroy() {
    this.venueSub?.unsubscribe();
    this.fulfillmentSub?.unsubscribe();
    this.totalsSub?.unsubscribe();
  }

  setPaymentMethod(method: PaymentMethod) {
    if (method === 'POINTS' && !this.wallet) return;
    this.paymentMethod = method;
  }

  private recalcPoints() {
    combineLatest([this.cartService.productsTotal$, this.cartService.deliveryFee$]).subscribe(([products, fee]) => {
      this.pointsTotal = pointsPrice(products, fee, this.wallet?.markupPercent ?? 20);
      this.cdr.detectChanges();
    }).unsubscribe();
  }

  toggleDelivery(status: boolean) {
    if (status && !this.canDeliver) return;
    this.cartService.setFulfillment(status ? 'DELIVERY' : 'PICKUP');
  }

  checkout() {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    if (!this.fulfillment) {
      alert('Выберите, как получить заказ: самовывоз или доставка');
      return;
    }

    const payWithPoints = this.paymentMethod === 'POINTS';
    if (payWithPoints && this.notEnoughPoints > 0) {
      alert(`Не хватает ${this.notEnoughPoints} баллов`);
      return;
    }

    if(!payWithPoints && !this.paymentFrom.trim()) {
      alert('Пожалуйста, впишите от кого поступит оплата!')
      return;
    }
  
    if (this.isDelivery && !this.address.trim()) {
      alert('Пожалуйста, введите адрес доставки');
      return;
    }
  
    this.isSubmitting = true;
  
    const finalAddress = this.isDelivery ? this.address.trim() : null;
    const comment = this.orderComment.trim();
  
    this.cartService.checkout(finalAddress, comment, this.paymentFrom, this.paymentMethod).subscribe({
      next: () => {
        this.isSubmitting = false;
        this.cartService.clearCart(); 
        this.router.navigate(['/orders']); 
      },
      error: (err) => {
        this.isSubmitting = false;
        console.error('Ошибка при оформлении заказа', err);
        alert(err.error?.message || 'Не удалось оформить заказ');
        this.cdr.detectChanges();
      }
    });
  }
}