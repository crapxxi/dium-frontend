import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { AdminWallet, SettlementReport, Wallet } from '../models/api.models';

/**
 * Баллы: зарабатываются доставкой, тратятся на заказы. Методы админки вызывать только
 * под администратором — на 403 интерсептор выходит из аккаунта.
 */
@Injectable({ providedIn: 'root' })
export class WalletService {
  private http = inject(HttpClient);
  private api = `${environment.apiUrl}/wallet`;
  private adminApi = `${environment.apiUrl}/admin`;

  getMyWallet(): Observable<Wallet> {
    return this.http.get<Wallet>(this.api);
  }

  findByPhone(phone: string): Observable<AdminWallet> {
    return this.http.get<AdminWallet>(`${this.adminApi}/wallets`, { params: new HttpParams().set('phone', phone) });
  }

  adjust(userId: number, amount: number, reason: string): Observable<AdminWallet> {
    return this.http.post<AdminWallet>(`${this.adminApi}/wallets/${userId}/adjustments`, { amount, reason });
  }

  getSettlements(from: string, to: string): Observable<SettlementReport> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<SettlementReport>(`${this.adminApi}/settlements`, { params });
  }
}

/**
 * Цена в баллах — так же, как считает сервер: еда и доставка отдельно, каждая с наценкой
 * и округлением вверх. Сервер всё равно пересчитает по своим ценам.
 */
export function pointsPrice(itemsTotal: number, deliveryFee: number, markupPercent: number): number {
  const withMarkup = (tenge: number) => (tenge > 0 ? Math.ceil((tenge * (100 + markupPercent)) / 100 - 1e-9) : 0);
  return withMarkup(itemsTotal) + withMarkup(deliveryFee);
}
