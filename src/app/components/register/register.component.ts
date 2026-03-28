import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
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

  public errorMessage = '';

  onSubmit() {
    this.errorMessage = '';
    this.isLoading = true;
  
    if (this.registerData.password !== this.registerData.confirmPassword) {
      this.errorMessage = 'Пароли не совпадают';
      return;
    }
  
    let cleanPhone = (this.registerData.phone || '').replace(/\D/g, '');
  
    if (cleanPhone.startsWith('8') && cleanPhone.length === 11) {
      cleanPhone = '7' + cleanPhone.substring(1);
    }
    
    if (cleanPhone.length === 10) {
      cleanPhone = '7' + cleanPhone;
    }
  
    if (cleanPhone.length !== 11) {
      this.errorMessage = 'Введите корректный номер (11 цифр)';
      return;
    }
  
    const finalData = {
      name: this.registerData.name,
      phone: cleanPhone,
      password: this.registerData.password
    };
  
    console.log('Отправка на регистрацию:', finalData);
  
    this.authService.register(finalData).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/login']);
      },
      error: (err) => {
        console.error(err);
        this.isLoading = false;
        this.errorMessage = err.error?.message || 'Этот номер уже зарегистрирован';
        this.cdr.detectChanges();
      }
    });
  }
}