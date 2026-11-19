import { Component, inject, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms'; 
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';
import { TranslateModule } from '@ngx-translate/core';
import { FulfillmentType } from '../../models/api.models';


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
  }

  ngOnDestroy() {
    this.venueSub?.unsubscribe();
    this.fulfillmentSub?.unsubscribe();
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

    if(!this.paymentFrom.trim()) {
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
  
    this.cartService.checkout(finalAddress, comment, this.paymentFrom).subscribe({
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