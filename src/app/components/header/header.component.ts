import { Component, inject, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { CartService } from '../../services/cart.service';
import { Observable } from 'rxjs';
import { User } from '../../models/api.models';
import { TranslateModule, TranslateService } from '@ngx-translate/core';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive, TranslateModule],
  templateUrl: './header.component.html'
})
export class HeaderComponent {
  authService = inject(AuthService);
  cartService = inject(CartService);
  public translate = inject(TranslateService);
  private platformId = inject(PLATFORM_ID);

  readonly languages = ['ru', 'kz', 'en'];
  
  user: Observable<User | null> = this.authService.currentUser$;   

  isMenuOpen = false;

  constructor() {
    let savedLang = 'ru';

    if (isPlatformBrowser(this.platformId)) {
      const stored = localStorage.getItem('dium_lang');
      if (stored) {
        savedLang = stored;
      }
    }
    
    this.translate.use(savedLang);
  }

  changeLanguage(lang: string) {
    this.translate.use(lang);
    
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('dium_lang', lang);
    }
  }

  get currentLang(): string {
    return this.translate.currentLang || 'ru';
  }

  toggleMenu() {
    this.isMenuOpen = !this.isMenuOpen;
  }

  logout() {
    this.authService.logout();
    this.isMenuOpen = false;
  }
}