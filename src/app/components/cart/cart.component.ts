import { Component, inject, ChangeDetectorRef, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms'; 
import { CartService } from '../../services/cart.service';
import { AuthService } from '../../services/auth.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule], 
  templateUrl: './cart.component.html'
})
export class CartComponent implements OnInit, OnDestroy {
  public cartService = inject(CartService);
  public authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  public isSubmitting = false;
  public isDelivery = false; 
  public address = '';       
  public orderComment = ''; 
  
  public canDeliver = false;
  private venueSub?: Subscription;

  ngOnInit() {
    this.cartService.setDeliveryMode(false);

    this.venueSub = this.cartService.currentVenue$.subscribe(venue => {
      this.canDeliver = venue?.canDeliver ?? false;
      
      if (!this.canDeliver && this.isDelivery) {
        this.toggleDelivery(false);
      }
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    this.venueSub?.unsubscribe();
  }

  toggleDelivery(status: boolean) {
    if (status && !this.canDeliver) return;

    this.isDelivery = status;
    this.cartService.setDeliveryMode(status);
  }

  checkout() {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
  
    if (this.isDelivery && !this.address.trim()) {
      alert('Пожалуйста, введите адрес доставки');
      return;
    }
  
    this.isSubmitting = true;
  
    const finalAddress = this.isDelivery ? this.address.trim() : null;
    const comment = this.orderComment.trim();
  
    this.cartService.checkout(finalAddress, comment).subscribe({
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