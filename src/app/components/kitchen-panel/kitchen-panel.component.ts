import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { OrderResponse } from '../../models/api.models';
import { Subscription, interval, startWith, switchMap, map } from 'rxjs';
import { environment } from '../../../environments/environment';

type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

@Component({
  selector: 'app-kitchen-panel',
  standalone: true,
  imports: [CommonModule],
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
    this.http.patch(`${environment.apiUrl}/orders/${orderId}/status?status=${newStatus}`, {})
      .subscribe({
        next: () => {
          if (newStatus === 'COMPLETED' || newStatus === 'CANCELLED') {
            this.orders = this.orders.filter(o => o.id !== orderId);
          } else {
            const order = this.orders.find(o => o.id === orderId);
            if (order) {
              order.status = newStatus;
              this.sortOrders();
            }
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Ошибка PATCH статуса:', err);
          alert('Не удалось обновить статус. Проверьте соединение или права доступа.');
        }
      });
  }

  private sortOrders() {
    this.orders.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  cancelOrder(orderId: number) {
    if (confirm(`Отменить заказ #${orderId}? Это действие нельзя отменить.`)) {
      this.updateStatus(orderId, 'CANCELLED');
    }
  }

  ngOnDestroy() {
    this.refreshSub?.unsubscribe();
  }
}