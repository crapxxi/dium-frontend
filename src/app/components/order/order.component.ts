import { Component, inject, afterNextRender, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router'; 
import { OrderResponse } from '../../models/api.models';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './order.component.html'
})
export class OrdersComponent {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  
  orders = signal<OrderResponse[]>([]);
  isLoading = signal(true);
  
  isPaymentLoading = signal<{ [orderId: number]: boolean }>({});

  constructor() {
    afterNextRender(() => {
      this.loadOrders();
    });
  }

  loadOrders() {
    this.http.get<OrderResponse[]>(`${environment.apiUrl}/orders/user`).subscribe({
      next: (data) => {
        const sortedData = data.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        this.orders.set(sortedData);
        this.isLoading.set(false);
        this.cdr.detectChanges(); 
      },
      error: (err) => {
        console.error('Ошибка загрузки заказов:', err);
        this.isLoading.set(false);
        this.cdr.detectChanges();
      }
    });
  }

  getItemTotal(item: any): number {
    const modsPrice = item.modifiers?.reduce((sum: number, m: any) => sum + m.priceDelta, 0) || 0;
    return (item.priceAtPurchase + modsPrice) * item.count;
  }

  getStatusClass(status: string): string {
    const base = 'px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest ';
    const classes: Record<string, string> = {
      'PENDING': 'bg-orange-500 text-white shadow-lg shadow-orange-100',
      'PREPARING': 'bg-blue-500 text-white shadow-lg shadow-blue-100',
      'READY': 'bg-green-500 text-white shadow-lg shadow-green-100 animate-pulse',
      'CANCELLED': 'bg-red-50 text-red-500 border border-red-100',
      'COMPLETED': 'bg-gray-100 text-gray-400'
    };
    return base + (classes[status] || 'bg-gray-100 text-gray-600');
  }

  translateStatus(status: string): string {
    const translations: Record<string, string> = {
      'PENDING': 'Ожидается оплата',
      'PREPARING': 'Готовится',
      'READY': 'Готов к выдаче',
      'COMPLETED': 'Получен',
      'CANCELLED': 'Отменен'
    };
    return translations[status] || status;
  }

  makeOrder(orderId: number) {
    if (!orderId) return;

    this.isPaymentLoading.update(state => ({ ...state, [orderId]: true }));
    this.cdr.detectChanges();

    this.http.get(`${environment.apiUrl}/orders/${orderId}/kaspi-url`, { responseType: 'text' })
      .subscribe({
        next: (url: string) => {
          this.isPaymentLoading.update(state => ({ ...state, [orderId]: false }));
          this.cdr.detectChanges();
          
          if (url && url.startsWith('http')) {
             window.location.href = url;
          } else {
             alert('Заведение еще не настроило ссылку для оплаты.');
          }
        },
        error: (err) => {
          console.error('Ошибка получения ссылки Kaspi:', err);
          this.isPaymentLoading.update(state => ({ ...state, [orderId]: false }));
          this.cdr.detectChanges();
          
          if (err.status === 404 || err.status === 400) {
              alert('Заведение пока не принимает онлайн-оплату.');
          } else {
              alert('Произошла ошибка при попытке открыть оплату.');
          }
        }
      });
  }
}