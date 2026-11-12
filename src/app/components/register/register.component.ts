import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { TranslateModule } from '@ngx-translate/core';
import { normalizeKzPhone } from '../../utils/phone';
import { apiErrorMessage } from '../../utils/http-error';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, TranslateModule],
  templateUrl: './register.component.html'
})
export class RegisterComponent {
  isLoading = false;
  private authService = inject(AuthService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  registerData = {
    name: '',
    phone: '',
    password: '',
    confirmPassword: ''
  };

  /** Ключ перевода либо готовый текст ошибки от сервера (в шаблоне проходит через translate). */
  public errorMessage = '';

  onSubmit() {
    this.errorMessage = '';
    this.isLoading = true;

    if (this.registerData.password !== this.registerData.confirmPassword) {
      this.errorMessage = 'ERRORS.PW_MISMATCH';
      this.isLoading = false;
      return;
    }

    const cleanPhone = normalizeKzPhone(this.registerData.phone);

    if (!cleanPhone) {
      this.errorMessage = 'ERRORS.PHONE_INVALID';
      this.isLoading = false;
      return;
    }

    const finalData = {
      name: this.registerData.name,
      phone: cleanPhone,
      password: this.registerData.password
    };

    this.authService.register(finalData).subscribe({
      next: () => {
        this.isLoading = false;
        // Бэкенд отвечает 200 только если код действительно ушёл в WhatsApp
        this.router.navigate(['/activate'], { queryParams: { phone: cleanPhone } });
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
        // Показываем причину от сервера: номер занят, код не отправлен (502), лимит запросов (429)...
        this.errorMessage = apiErrorMessage(err, 'ERRORS.REGISTER_FAILED');
        this.cdr.detectChanges();
      }
    });
  }
}
