import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, tap, Observable, throwError, of } from 'rxjs';
import { User, LoginRequest, AuthResponse } from '../models/api.models';
import { Router } from '@angular/router';
import { isPlatformBrowser } from '@angular/common';
import { CartService } from './cart.service';
import { catchError, shareReplay } from 'rxjs/operators';
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

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const token = this.getToken();
      if (token) {
        this.getMe().subscribe({
          error: (err) => {
            console.error('Сессия не валидна:', err);
          }
        });
      }
    }
  }

  login(credentials: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, credentials).pipe(
      tap(res => {
        if (isPlatformBrowser(this.platformId)) {
          localStorage.setItem('token', res.token);
          this.getMe().subscribe(() => this.router.navigate(['/venues']));
        }
      })
    );
  }

  register(data: any): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register`, data).pipe(
      tap(res => {
        if (isPlatformBrowser(this.platformId) && res.token) {
          localStorage.setItem('token', res.token);
          this.getMe().subscribe(() => this.router.navigate(['/venues']));
        }
      })
    );
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
}