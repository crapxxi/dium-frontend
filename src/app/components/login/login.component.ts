import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { RouterLink, Router } from '@angular/router';
import { LoginRequest } from '../../models/api.models';
import { TranslateModule } from '@ngx-translate/core';
import { normalizeKzPhone } from '../../utils/phone';
import { apiErrorMessage } from '../../utils/http-error';

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

  /** Ключ перевода либо готовый текст ошибки от сервера (в шаблоне проходит через translate). */
  public errorMessage = '';
  public isLoading = false;

  loginForm = this.fb.group({
    phone: ['', [Validators.required, Validators.minLength(10)]],
    password: ['', [Validators.required, Validators.minLength(4)]]
  });

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      this.errorMessage = 'ERRORS.FILL_LOGIN';
      return;
    }

    this.errorMessage = '';
    this.isLoading = true;

    const rawPhone = this.loginForm.get('phone')?.value || '';
    const rawPassword = this.loginForm.get('password')?.value || '';

    const cleanPhone = normalizeKzPhone(rawPhone);

    if (!cleanPhone) {
      this.isLoading = false;
      this.errorMessage = 'ERRORS.PHONE_INVALID';
      return;
    }

    const dataToSubmit: LoginRequest = {
      phone: cleanPhone,
      password: rawPassword
    };

    this.authService.login(dataToSubmit).subscribe({
      next: (res) => {
        this.isLoading = false;
        if (res.twoFactorRequired) {
          // Пароль верный, но JWT ещё не выдан — нужен код второго фактора
          this.router.navigate(['/2fa-verify']);
          return;
        }
        this.router.navigate(['/venues']);
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Ошибка при входе:', err);

        const serverMessage: string = err.error?.message || '';

        if (serverMessage.includes('ACCOUNT_LOCKED')) {
          this.router.navigate(['/activate'], { queryParams: { phone: cleanPhone } });
          return;
        }

        if (err.status === 403 || err.status === 401 || err.status === 400) {
          this.errorMessage = 'ERRORS.WRONG_CREDENTIALS';
        } else {
          // 429 (лимит запросов), 502 (код не отправлен) и т.п. — показываем текст сервера
          this.errorMessage = apiErrorMessage(err, 'ERRORS.SERVER');
        }

        this.cdr.detectChanges();
      }
    });
  }
}
