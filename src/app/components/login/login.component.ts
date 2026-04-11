import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { RouterLink, Router } from '@angular/router';
import { LoginRequest } from '../../models/api.models';
import { TranslateModule } from '@ngx-translate/core';


@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  
  public errorMessage = ''; 
  public isLoading = false;

  loginForm = this.fb.group({
    phone: ['', [Validators.required, Validators.minLength(10)]],
    password: ['', [Validators.required, Validators.minLength(4)]]
  });

  onSubmit() {
    if (this.loginForm.invalid) return;

    this.errorMessage = '';
    this.isLoading = true;
    
    const rawPhone = this.loginForm.get('phone')?.value || '';
    const rawPassword = this.loginForm.get('password')?.value || '';

    let cleanPhone = rawPhone.replace(/\D/g, '');

    if (cleanPhone.startsWith('8') && cleanPhone.length === 11) {
      cleanPhone = '7' + cleanPhone.substring(1);
    }
    
    if (cleanPhone.length === 10) {
      cleanPhone = '7' + cleanPhone;
    }

    if (cleanPhone.length !== 11) {
      this.isLoading = false;
      this.errorMessage = 'Введите корректный номер (11 цифр)';
      return;
    }

    const dataToSubmit: LoginRequest = {
      phone: cleanPhone,
      password: rawPassword
    };

    console.log('Отправка на вход:', dataToSubmit);

    this.authService.login(dataToSubmit).subscribe({
      next: (response) => {
        this.isLoading = false;
        this.router.navigate(['/venues']);
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Ошибка при входе:', err);
    
        if (err.status === 403 || err.status === 401) {
          this.errorMessage = 'Неверный номер телефона или пароль';
        } else {
          this.errorMessage = err.error?.message || 'Ошибка сервера. Попробуйте позже';
        }
        
        this.cdr.detectChanges();
      }
    });
  }
}