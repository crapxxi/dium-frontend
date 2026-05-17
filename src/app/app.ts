import { Component, signal, inject, PLATFORM_ID } from '@angular/core';
import { RouterOutlet, RouterLink } from '@angular/router';
import { HeaderComponent } from './components/header/header.component';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, HeaderComponent, TranslateModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('dium');
  private translate = inject(TranslateService);
  private platformId = inject(PLATFORM_ID);

  constructor() {
    this.translate.setDefaultLang('ru');
    
    let savedLang = 'ru';
    
    if (isPlatformBrowser(this.platformId)) {
      const storedLang = localStorage.getItem('dium_lang');
      if (storedLang) {
        savedLang = storedLang;
      }
    }
    
    this.translate.use(savedLang);
  }
}