import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { OrderResponse, VenueDelivery } from '../../models/api.models';
import { Subscription, catchError, interval, of, startWith, switchMap, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TranslateModule } from '@ngx-translate/core';
import { DeliveryService } from '../../services/delivery.service';
import { VenueDeliveriesComponent } from '../venue-deliveries/venue-deliveries.component';

type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';

@Component({
  selector: 'app-kitchen-panel',
  standalone: true,
  imports: [CommonModule, TranslateModule, VenueDeliveriesComponent],
  templateUrl: './kitchen-panel.html'
})
export class KitchenPanelComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  
  private deliveryService = inject(DeliveryService);
  private platformId = inject(PLATFORM_ID);

  orders: OrderResponse[] = [];
  isLoading = true; 
  private refreshSub?: Subscription;

  /** Вкладки кухни: заказы и доставки студентами. */
  tab: 'orders' | 'deliveries' = 'orders';
  deliveries: VenueDelivery[] = [];
  private deliveryByOrder = new Map<number, VenueDelivery>();
  private deliveriesSub?: Subscription;

  ngOnInit() {
    // Только в браузере: при серверном рендере нет токена, запрос получил бы 403,
    // и интерсептор отправил бы владельца на /login при прямом открытии /kitchen
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }
    this.startDeliveriesPolling();

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

  private startDeliveriesPolling() {
    this.deliveriesSub = interval(5000).pipe(
      startWith(0),
      switchMap(() => this.deliveryService.getVenueDeliveries().pipe(catchError(() => of(this.deliveries))))
    ).subscribe((list) => {
      this.applyDeliveries(list);
      this.cdr.detectChanges();
    });
  }

  setTab(tab: 'orders' | 'deliveries') {
    this.tab = tab;
    this.loadDeliveries();
  }

  loadDeliveries() {
    this.deliveryService.getVenueDeliveries().pipe(catchError(() => of(this.deliveries))).subscribe((list) => {
      this.applyDeliveries(list);
      this.cdr.detectChanges();
    });
  }

  private applyDeliveries(list: VenueDelivery[]) {
    this.deliveries = list;
    this.deliveryByOrder = new Map(list.map((d) => [d.orderId, d]));
  }

  /** Незавершённая доставка заказа: такой заказ завершает курьер, а не кухня. */
  activeDelivery(orderId: number): VenueDelivery | null {
    const delivery = this.deliveryByOrder.get(orderId);
    return delivery && (delivery.status === 'SEARCHING_COURIER' || delivery.status === 'ASSIGNED' || delivery.status === 'PICKED_UP')
      ? delivery
      : null;
  }

  /** Сколько курьеров ждут передачи заказа — для бейджа на вкладке. */
  get couriersWaiting(): number {
    return this.deliveries.filter((d) => d.status === 'ASSIGNED').length;
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
          // responseType 'text': тело ошибки приходит строкой JSON
          let message = '';
          try {
            message = typeof err?.error === 'string' ? JSON.parse(err.error).message : err?.error?.message;
          } catch {
            message = '';
          }
          alert(message || 'Не удалось обновить статус');
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
    this.deliveriesSub?.unsubscribe();
  }
}