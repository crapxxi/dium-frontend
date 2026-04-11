import { HttpInterceptorFn } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (req, next) => {

  if (req.url.includes('/assets/i18n/') || req.url.endsWith('.json')) {
    return next(req);
  }
  
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  

  if (token) {
    console.log(`[AuthInterceptor] Добавляем токен для: ${req.url}`);
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token.trim()}`
      }
    });
    return next(cloned);
  }

  console.warn(`[AuthInterceptor] Токен не найден для запроса: ${req.url}`);
  return next(req);
};