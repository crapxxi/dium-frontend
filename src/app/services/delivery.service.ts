import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  AdminDelivery,
  AdminDeliveryAction,
  AvailableDelivery,
  CourierDelivery,
  CourierSummary,
  CustomerDelivery,
  DeliveryIssue,
  DeliveryIssueStatus,
  DeliveryIssueType,
  DeliveryStatus,
  VenueDelivery,
} from '../models/api.models';

/**
 * API доставки. Методы разделены по сторонам: курьер и заказчик — студенты (роль CLIENT),
 * заведение — VENUE_OWNER, админка — ADMIN. Вызывать только методы своей роли:
 * на 403 интерсептор выходит из аккаунта.
 */
@Injectable({ providedIn: 'root' })
export class DeliveryService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/deliveries`;
  private adminApi = `${environment.apiUrl}/admin/deliveries`;

  // ───────── курьер ─────────
  getAvailable(): Observable<AvailableDelivery[]> {
    return this.http.get<AvailableDelivery[]>(`${this.api}/available`);
  }

  accept(deliveryId: number): Observable<CourierDelivery> {
    return this.http.post<CourierDelivery>(`${this.api}/${deliveryId}/accept`, {});
  }

  release(deliveryId: number): Observable<CourierDelivery> {
    return this.http.post<CourierDelivery>(`${this.api}/${deliveryId}/release`, {});
  }

  /** Курьер вводит код, который назвал клиент. */
  confirmDelivered(deliveryId: number, code: string): Observable<CourierDelivery> {
    return this.http.post<CourierDelivery>(`${this.api}/${deliveryId}/deliver`, { code });
  }

  getCourierDeliveries(): Observable<CourierDelivery[]> {
    return this.http.get<CourierDelivery[]>(`${this.api}/courier`);
  }

  getCourierSummary(): Observable<CourierSummary> {
    return this.http.get<CourierSummary>(`${this.api}/courier/summary`);
  }

  // ───────── заказчик ─────────
  getCustomerDeliveries(): Observable<CustomerDelivery[]> {
    return this.http.get<CustomerDelivery[]>(`${this.api}/customer`);
  }

  // ───────── заведение ─────────
  getVenueDeliveries(): Observable<VenueDelivery[]> {
    return this.http.get<VenueDelivery[]>(`${this.api}/venue`);
  }

  /** Заведение вводит код, который показал курьер. */
  confirmPickup(deliveryId: number, code: string): Observable<VenueDelivery> {
    return this.http.post<VenueDelivery>(`${this.api}/${deliveryId}/pickup`, { code });
  }

  // ───────── проблемы ─────────
  reportIssue(deliveryId: number, type: DeliveryIssueType, description: string): Observable<DeliveryIssue> {
    return this.http.post<DeliveryIssue>(`${this.api}/${deliveryId}/issues`, { type, description });
  }

  // ───────── админка ─────────
  getAdminDeliveries(status: DeliveryStatus | null): Observable<AdminDelivery[]> {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http.get<AdminDelivery[]>(this.adminApi, { params });
  }

  getIssues(status: DeliveryIssueStatus | null): Observable<DeliveryIssue[]> {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http.get<DeliveryIssue[]>(`${this.adminApi}/issues`, { params });
  }

  adminAction(deliveryId: number, action: AdminDeliveryAction, reason: string): Observable<AdminDelivery> {
    return this.http.post<AdminDelivery>(`${this.adminApi}/${deliveryId}/${action}`, { reason });
  }

  resolveIssue(issueId: number, resolution: string): Observable<DeliveryIssue> {
    return this.http.post<DeliveryIssue>(`${this.adminApi}/issues/${issueId}/resolve`, { resolution });
  }
}
