import { Component, inject, OnInit, OnDestroy, ChangeDetectorRef, PLATFORM_ID } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { Subscription, filter } from 'rxjs'; 
import { User, Venue } from '../../models/api.models';
import { SupportComponent } from '../support/support.component';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './profile.component.html'
})
export class ProfileComponent implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  private http = inject(HttpClient);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private platformId = inject(PLATFORM_ID);

  user: User | null = this.authService.currentUserValue;
  userVenue: Venue | null = null;
  
  isLoading = true;
  isVenueLoading = false;
  private authSub?: Subscription;

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) {
      return; 
    }

    const token = this.authService.getToken();
    
    if (!token) {
      console.warn('[Profile] Нет токена, редирект на login');
      this.router.navigate(['/login']);
      return;
    }


    this.authSub = this.authService.currentUser$.pipe(
      filter(userData => userData !== null || !this.authService.getToken())
    ).subscribe({
      next: (userData) => {
        if (!userData) {
          this.router.navigate(['/login']);
          return;
        }

        this.user = userData;
        this.isLoading = false;
        
        if (userData.role === 'VENUE_OWNER') {
          this.loadUserVenue();
        }
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[Profile] Ошибка загрузки пользователя:', err);
        this.router.navigate(['/login']);
      }
    });
  }

  loadUserVenue() {
    this.isVenueLoading = true;
    this.http.get<Venue>(`${environment.apiUrl}/venues/manage/my`).subscribe({
      next: (venue) => {
        this.userVenue = venue;
        this.isVenueLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('[Profile] Ошибка заведения:', err);
        this.userVenue = null;
        this.isVenueLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  getRoleLabel(role?: string): string {
    const labels: Record<string, string> = {
      'ADMIN': 'Администратор',
      'VENUE_OWNER': 'Владелец заведения',
      'CLIENT': 'Клиент'
    };
    return role ? labels[role] || 'Пользователь' : 'Загрузка...';
  }

  getRoleClass(role?: string): string {
    const classes: Record<string, string> = {
      'ADMIN': 'bg-red-50 text-red-600 border-red-100',
      'VENUE_OWNER': 'bg-blue-50 text-blue-600 border-blue-100',
      'CLIENT': 'bg-orange-50 text-orange-600 border-orange-100'
    };
    return role ? classes[role] || 'bg-gray-50' : 'bg-gray-50';
  }

  logout() {
    this.authService.logout();
  }

  ngOnDestroy() {
    this.authSub?.unsubscribe();
  }
}