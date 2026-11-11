import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { catchError, shareReplay, tap, switchMap, map } from 'rxjs/operators';
import {
  User,
  LoginRequest,
  AuthResponse,
  PendingTwoFactor,
  TwoFactorMethod,
  TwoFactorCodeType,
  TwoFactorStatus,
  TwoFactorSetupResponse,
  BackupCodesResponse,
} from '../models/api.models';
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
  private readonly pendingTwoFactorKey = 'dium_2fa_pending';

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
    }
  }

  /**
   * Вход по телефону и паролю.
   * Если в ответе twoFactorRequired === true, JWT ещё не выдан: сохраняем временный токен
   * и вызывающий компонент должен перейти на /2fa-verify.
   */
  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials).pipe(
      switchMap(res => {
        if (res.twoFactorRequired && res.tempToken) {
          this.setPendingTwoFactor(res);
          return of(res);
        }
        return this.completeLogin(res);
      })
    );
  }

  /** Сохраняет настоящий JWT и загружает профиль. */
  private completeLogin(res: AuthResponse): Observable<AuthResponse> {
    if (isPlatformBrowser(this.platformId) && res.token) {
      this.clearPendingTwoFactor();
      localStorage.setItem('token', res.token);
      this.scheduleTokenExpiry(res.token);
      return this.getMe().pipe(map(() => res));
    }
    return of(res);
  }

  register(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/register`, data);
  }

  activateAccount(phone: string, code: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/activate`, null, {
      params: { phone, code }
    }).pipe(
      switchMap(res => this.completeLogin(res))
    );
  }

  // ───────────────────────── 2FA: завершение входа ─────────────────────────

  private setPendingTwoFactor(res: AuthResponse): void {
    if (!isPlatformBrowser(this.platformId) || !res.tempToken) return;

    const method: TwoFactorMethod = res.twoFactorMethod || 'WHATSAPP';
    const pending: PendingTwoFactor = {
      tempToken: res.tempToken,
      phone: res.phone,
      method,
      availableMethods: res.availableMethods?.length ? res.availableMethods : [method],
      codeSent: res.codeSent === true,
      backupCodesAvailable: res.backupCodesAvailable === true,
      expiresAt: this.tokenExpiryMs(res.tempToken) ?? Date.now() + 5 * 60 * 1000,
    };
    sessionStorage.setItem(this.pendingTwoFactorKey, JSON.stringify(pending));
  }

  /** Незавершённый вход, ожидающий код. null — если его нет или временный токен уже истёк. */
  getPendingTwoFactor(): PendingTwoFactor | null {
    if (!isPlatformBrowser(this.platformId)) return null;

    const raw = sessionStorage.getItem(this.pendingTwoFactorKey);
    if (!raw) return null;
    try {
      const pending = JSON.parse(raw) as PendingTwoFactor;
      if (!pending.tempToken || pending.expiresAt <= Date.now()) {
        this.clearPendingTwoFactor();
        return null;
      }
      return pending;
    } catch {
      this.clearPendingTwoFactor();
      return null;
    }
  }

  clearPendingTwoFactor(): void {
    if (isPlatformBrowser(this.platformId)) {
      sessionStorage.removeItem(this.pendingTwoFactorKey);
    }
  }

  /** Проверяет код второго фактора. Только после этого бэкенд выдаёт настоящий JWT. */
  verifyTwoFactor(code: string, method: TwoFactorCodeType): Observable<AuthResponse> {
    const pending = this.getPendingTwoFactor();
    if (!pending) {
      return throwError(() => ({ status: 401, error: { message: 'TWO_FA.SESSION_EXPIRED' } }));
    }
    return this.http
      .post<AuthResponse>(`${this.apiUrl}/2fa/verify`, { tempToken: pending.tempToken, code, method })
      .pipe(switchMap(res => this.completeLogin(res)));
  }

  /** Отправляет (повторно) WhatsApp-код для незавершённого входа. */
  sendTwoFactorLoginCode(): Observable<void> {
    const pending = this.getPendingTwoFactor();
    if (!pending) {
      return throwError(() => ({ status: 401, error: { message: 'TWO_FA.SESSION_EXPIRED' } }));
    }
    return this.http.post<void>(`${this.apiUrl}/2fa/verify/send-code`, { tempToken: pending.tempToken });
  }

  // ───────────────────────── 2FA: управление в профиле ─────────────────────────

  getTwoFactorStatus(): Observable<TwoFactorStatus> {
    return this.http.get<TwoFactorStatus>(`${this.apiUrl}/2fa/status`);
  }

  /** TOTP: возвращает секрет и QR-код. WHATSAPP: отправляет проверочный код. */
  setupTwoFactor(method: TwoFactorMethod): Observable<TwoFactorSetupResponse> {
    return this.http.post<TwoFactorSetupResponse>(`${this.apiUrl}/2fa/setup`, { method });
  }

  /** Включает 2FA. Резервные коды в ответе показываются пользователю только один раз. */
  enableTwoFactor(method: TwoFactorMethod, code: string): Observable<BackupCodesResponse> {
    return this.http.post<BackupCodesResponse>(`${this.apiUrl}/2fa/enable`, { method, code });
  }

  /** WhatsApp-код текущему пользователю (нужен для отключения 2FA). */
  sendTwoFactorCode(): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/2fa/send-code`, {});
  }

  disableTwoFactor(password: string, code: string, method: TwoFactorCodeType): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/2fa/disable`, { password, code, method });
  }

  regenerateBackupCodes(password: string): Observable<BackupCodesResponse> {
    return this.http.post<BackupCodesResponse>(`${this.apiUrl}/2fa/backup-codes`, { password });
  }

  private tokenExpiryMs(token: string): number | null {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return payload.exp ? payload.exp * 1000 : null;
    } catch {
      return null;
    }
  }

  resendCode(phone: string): Observable<void> {
    return this.http.post<void>(`${this.apiUrl}/resend-code`, null, {
      params: { phone }
    });
  }

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

  logout() {
    if (this.expiryTimer) {
      clearTimeout(this.expiryTimer);
      this.expiryTimer = null;
    }
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('token');
      localStorage.removeItem('user_data');
      this.clearPendingTwoFactor();
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