import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { catchError, shareReplay, tap, switchMap, map } from 'rxjs/operators';
import { User, LoginRequest, AuthResponse } from '../models/api.models';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { CartService } from './cart.service';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private router = inject(Router);
  private cartService = inject(CartService);
  private apiUrl = `${environment.apiUrl}/auth`;

  private currentUserSubject = new BehaviorSubject<User | null>(this.getUserFromStorage());
  public currentUser$ = this.currentUserSubject.asObservable();

  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const token = this.getToken();
      if (token) {
        this.scheduleTokenExpiry(token);
        this.getMe().subscribe({
          error: (err) => console.error('Сессия не валидна:', err)
        });
      }
    }
  }

  private scheduleTokenExpiry(token: string): void {
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      if (!payload.exp) return;
      const msUntilExpiry = payload.exp * 1000 - Date.now();
      if (msUntilExpiry <= 0) {
        this.logout();
        return;
      }
      this.expiryTimer = setTimeout(() => this.logout(), msUntilExpiry);
    } catch {
      // malformed token — let the server reject it
    }
  }

  /**
   * Логин. Получает токен, ждет скачивания профиля (getMe) и возвращает ответ.
   * Редирект делает сам компонент (LoginComponent).
   */
  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials).pipe(
      switchMap(res => {
        if (isPlatformBrowser(this.platformId) && res.token) {
          localStorage.setItem('token', res.token);
          this.scheduleTokenExpiry(res.token);
          return this.getMe().pipe(map(() => res));
        }
        return of(res);
      })
    );
  }

  /**
   * Регистрация. Возвращает ответ для последующего перехода на окно ввода кода.
   */
  register(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, data);
  }

  /**
   * Подтверждение SMS кода. Логика идентична login:
   * сохраняем токен -> скачиваем данные -> отдаем управление компоненту.
   */
  activateAccount(phone: string, code: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/activate`, null, {
      params: { phone, code }
    }).pipe(
      switchMap(res => {
        if (isPlatformBrowser(this.platformId) && res.token) {
          localStorage.setItem('token', res.token);
          this.scheduleTokenExpiry(res.token);
          return this.getMe().pipe(map(() => res));
        }
        return of(res);
      })
    );
  }

  /**
   * Переотправка кода на телефон
   */
  resendCode(phone: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/resend-code`, null, {
      params: { phone }
    });
  }

  /**
   * Получение профиля текущего пользователя
   */
  getMe(): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/me`).pipe(
      tap(user => {
        if (isPlatformBrowser(this.platformId)) {
          localStorage.setItem('user_data', JSON.stringify(user));
        }
        this.currentUserSubject.next(user);
      }),
      catchError(err => {
        if (err.status === 401 || err.status === 403) {
          this.logout();
        }
        return throwError(() => err);
      }),
      shareReplay(1)
    );
  }

  /**
   * Выход из системы и очистка данных
   */
  logout() {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('token');
      localStorage.removeItem('user_data');
      this.cartService.clearCart();
    }
    this.currentUserSubject.next(null);
    if (!this.router.url.includes('/login') && !this.router.url.includes('/register')) {
        this.router.navigate(['/login']);
    }
  }

  public get currentUserValue(): User | null {
    return this.currentUserSubject.value;
  }

  getToken(): string | null {
    if (isPlatformBrowser(this.platformId)) {
      return localStorage.getItem('token');
    }
    return null;
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  private getUserFromStorage(): User | null {
    if (isPlatformBrowser(this.platformId)) {
      const savedUser = localStorage.getItem('user_data');
      if (!savedUser) return null;
      try {
        return JSON.parse(savedUser);
      } catch (e) {
        localStorage.removeItem('user_data');
        return null;
      }
    }
    return null;
  }

  requestPasswordReset(phone: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/forgot-password`, null, {
      params: { phone }
    });
  }

  resetPassword(data: { phone: string; code: string; newPassword: string }): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/reset-password`, data);
  }
}