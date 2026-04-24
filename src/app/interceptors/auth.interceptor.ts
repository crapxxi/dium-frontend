import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.url.includes('/assets/i18n/') || req.url.endsWith('.json')) {
    return next(req);
  }

  const authService = inject(AuthService);
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const cloned = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token.trim()}` } })
    : req;

  return next(cloned).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 || err.status === 403) {
        authService.logout();
      }
      return throwError(() => err);
    })
  );
};