import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Subscription, timer } from 'rxjs';

@Component({
  selector: 'app-activate',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './activate.component.html'
})
export class ActivateComponent implements OnInit, OnDestroy {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  phone: string = '';
  code: string = '';
  isLoading = false;
  resendCooldown = 0;
  
  private timerSub?: Subscription; 

  ngOnInit() {
    this.phone = this.route.snapshot.queryParams['phone'];
    
    if (!this.phone) {
      this.router.navigate(['/login']);
      return;
    }

    this.startCooldown();
  }

  onActivate() {
    if (this.code.length !== 4 || this.isLoading) return;
    
    this.isLoading = true;
    this.authService.activateAccount(this.phone, this.code).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/venues']); 
      },
      error: (err) => {
        this.isLoading = false;
        this.cdr.detectChanges();
        alert(err.error?.message || 'Неверный код подтверждения');
      }
    });
  }

  onResend() {
    if (this.resendCooldown > 0 || this.isLoading) return;

    this.authService.resendCode(this.phone).subscribe({
      next: () => {
        this.startCooldown();
      },
      error: (err) => {
        this.cdr.detectChanges();
        alert(err.error?.message || 'Ошибка при повторной отправке');
      }
    });
  }

  startCooldown() {
    if (this.timerSub) this.timerSub.unsubscribe();
    
    const durationInSeconds = 60;
    const endTime = Date.now() + (durationInSeconds * 1000);
    this.resendCooldown = durationInSeconds;

    this.timerSub = timer(0, 1000).subscribe(() => {
      const remainingTime = Math.round((endTime - Date.now()) / 1000);

      if (remainingTime <= 0) {
        this.resendCooldown = 0;
        if (this.timerSub) this.timerSub.unsubscribe();
      } else {
        this.resendCooldown = remainingTime;
      }
      
      this.cdr.detectChanges(); 
    });
  }

  ngOnDestroy() {
    if (this.timerSub) this.timerSub.unsubscribe();
  }
}