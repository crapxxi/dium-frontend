import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { OrderResponse } from '../../models/api.models';
import { Subscription, interval, startWith, switchMap, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TranslateModule } from '@ngx-translate/core';

type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

@Component({
  selector: 'app-kitchen-panel',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './kitchen-panel.html'
})
export class KitchenPanelComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  
  orders: OrderResponse[] = [];
  isLoading = true; 
  private refreshSub?: Subscription;

  ngOnInit() {
    this.refreshSub = interval(3000).pipe(
      startWith(0),
      switchMap(() => this.http.get<OrderResponse[]>(`${environment.apiUrl}/orders/kitchen`)),
      map(orders => orders.sort((a, b) => 
        new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      ))
    ).subscribe({
      next: (data) => {
        this.orders = data;
        this.isLoading = false; 
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Ошибка загрузки кухни:', err);
        this.isLoading = false; 
        this.cdr.detectChanges();
      }
    });
  }

  updateStatus(orderId: number, newStatus: OrderStatus) {
    this.http.patch(`${environment.apiUrl}/orders/${orderId}/status`, {}, { responseType: 'text' })
      .subscribe({
        next: () => {
          const index = this.orders.findIndex(o => o.id === orderId);
          if (index !== -1) {
            if (newStatus === 'COMPLETED' || newStatus === 'CANCELLED') {
              this.orders.splice(index, 1);
            } else {
              this.orders[index].status = newStatus;
              this.sortOrders();
            }
            this.cdr.detectChanges();
          }
        },
        error: (err) => {
          console.error('Ошибка:', err);
          alert('Не удалось обновить статус');
        }
      });
  }
  
  cancelOrder(orderId: number) {
    if (!confirm(`Отменить заказ #${orderId}?`)) return;
  
    this.http.patch(`${environment.apiUrl}/orders/${orderId}/cancel`, {}, { responseType: 'text' })
      .subscribe({
        next: () => {
          this.orders = this.orders.filter(o => o.id !== orderId);
          this.cdr.detectChanges();
        },
        error: (err) => {
          alert('Ошибка при отмене');
        }
      });
  }

  private sortOrders() {
    this.orders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  ngOnDestroy() {
    this.refreshSub?.unsubscribe();
  }
}