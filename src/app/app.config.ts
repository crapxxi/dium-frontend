import { ApplicationConfig } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http'; // Добавь withFetch здесь
import { authInterceptor } from './interceptors/auth.interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    // ВАЖНО: Добавь withFetch() внутрь provideHttpClient
    provideHttpClient(
      withFetch(), 
      withInterceptors([authInterceptor])
    )
  ]
};