import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { RouterLink } from '@angular/router';
import { environment } from '../../../environments/environment';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-admin-register-owner',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TranslateModule],
  templateUrl: './register-owner.component.html'
})
export class AdminRegisterOwnerComponent {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  public errorMessage = '';
  public successMessage = '';
  public isLoading = false;

  registerForm = this.fb.group({
    phone: ['', [Validators.required, Validators.minLength(10)]]
  });

  onSubmit() {
    if (this.registerForm.invalid) return;

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const rawPhone = this.registerForm.get('phone')?.value || '';
    let cleanPhone = rawPhone.replace(/\D/g, '');
    if (cleanPhone.startsWith('8')) cleanPhone = '7' + cleanPhone.substring(1);
    if (cleanPhone.length === 10) cleanPhone = '7' + cleanPhone;

    const payload = { phone: cleanPhone };

    this.http.post(`${environment.apiUrl}/auth/venue-register`, payload).subscribe({
      next: () => {
        this.isLoading = false;
        this.successMessage = 'Пользователь назначен владельцем заведения!';
        this.registerForm.reset();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Не удалось назначить владельца';
        this.cdr.detectChanges();
      }
    });
  }
}