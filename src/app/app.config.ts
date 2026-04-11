import { ApplicationConfig, importProvidersFrom } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { provideHttpClient, withInterceptors, withFetch } from '@angular/common/http'; 
import { authInterceptor } from './interceptors/auth.interceptor';
import { TranslateModule } from '@ngx-translate/core';

import { provideTranslateHttpLoader } from '@ngx-translate/http-loader'; 

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes),
    
    provideHttpClient(
      withFetch(), 
      withInterceptors([authInterceptor])
    ),

    importProvidersFrom(
      TranslateModule.forRoot({
        fallbackLang: 'ru',
        defaultLanguage: 'ru'
      })
    ),
    provideTranslateHttpLoader()
  ]
};