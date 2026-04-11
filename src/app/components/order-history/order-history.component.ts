import { Component, inject, afterNextRender, signal, computed, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { OrderResponse } from '../../models/api.models';
import { environment } from '../../../environments/environment';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';


@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './order-history.component.html'
})
export class OrderHistoryComponent {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  
  allOrders = signal<OrderResponse[]>([]);
  isLoading = signal(true);
  
  activeFilter = signal<'COMPLETED' | 'CANCELLED'>('COMPLETED');

  constructor() {
    afterNextRender(() => {
      this.loadHistory();
    });
  }

  loadHistory() {
    this.isLoading.set(true);
    this.http.get<OrderResponse[]>(`${environment.apiUrl}/orders/order-history`).subscribe({
      next: (data) => {
        const sortedData = data.sort((a, b) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        this.allOrders.set(sortedData);
        this.isLoading.set(false);
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Ошибка загрузки истории:', err);
        this.isLoading.set(false);
        this.cdr.detectChanges();
      }
    });
  }


  filteredOrders = computed(() => {
    return this.allOrders().filter(order => order.status === this.activeFilter());
  });

  totalRevenue = computed(() => {
    return this.allOrders()
      .filter(o => o.status === 'COMPLETED')
      .reduce((sum, order) => sum + (order.totalSum || 0), 0);
  });

  completedCount = computed(() => {
    return this.allOrders().filter(o => o.status === 'COMPLETED').length;
  });

  cancelledCount = computed(() => {
    return this.allOrders().filter(o => o.status === 'CANCELLED').length;
  });


  setFilter(status: 'COMPLETED' | 'CANCELLED') {
    this.activeFilter.set(status);
    this.cdr.detectChanges();
  }

  getStatusClass(status: string): string {
    const base = 'px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border ';
    return status === 'COMPLETED' 
      ? base + 'text-green-500 bg-green-50 border-green-100' 
      : base + 'text-red-500 bg-red-50 border-red-100';
  }
}