import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html'
})
export class ForgotPasswordComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  step: 1 | 2 = 1; 
  isLoading = false;
  errorMessage = '';

  phone = '';
  code = '';
  newPassword = '';
  confirmPassword = '';

  cleanPhoneNumber(rawPhone: string): string | null {
    let clean = rawPhone.replace(/\D/g, '');
    if (clean.startsWith('8') && clean.length === 11) clean = '7' + clean.substring(1);
    if (clean.length === 10) clean = '7' + clean;
    return clean.length === 11 ? clean : null;
  }

  onRequestCode() {
    this.errorMessage = '';
    const cleanPhone = this.cleanPhoneNumber(this.phone);

    if (!cleanPhone) {
      this.errorMessage = 'Введите корректный номер (11 цифр)';
      return;
    }

    this.isLoading = true;
    this.phone = cleanPhone;

    this.authService.requestPasswordReset(cleanPhone).subscribe({
      next: () => {
        this.isLoading = false;
        this.step = 2;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Ошибка запроса кода:', err);
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Пользователь с таким номером не найден';
        this.cdr.detectChanges();
      }
    });
  }

  onResetPassword() {
    this.errorMessage = '';

    if (this.code.length !== 4) {
      this.errorMessage = 'Введите 4-значный код';
      return;
    }
    if (this.newPassword.length < 6) {
      this.errorMessage = 'Пароль должен содержать минимум 6 символов';
      return;
    }
    if (this.newPassword !== this.confirmPassword) {
      this.errorMessage = 'Пароли не совпадают';
      return;
    }

    this.isLoading = true;
    this.authService.resetPassword({
      phone: this.phone,
      code: this.code,
      newPassword: this.newPassword
    }).subscribe({
      next: () => {
        this.isLoading = false;
        alert('Пароль успешно изменен!');
        this.router.navigate(['/login']);
      },
      error: (err) => {
        console.error('Ошибка сброса пароля:', err);
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Неверный код или ошибка сервера';
        this.cdr.detectChanges();
      }
    });
  }
}