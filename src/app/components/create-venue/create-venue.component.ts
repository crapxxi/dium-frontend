import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { TranslateModule } from '@ngx-translate/core';


@Component({
  selector: 'app-create-venue',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslateModule],
  templateUrl: './create-venue.component.html'
})
export class CreateVenueComponent {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);

  isLoading = false;
  errorMessage = '';
  selectedFile: File | null = null;
  imagePreview: string | null = null;

  venueForm = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    address: ['', [Validators.required]],
    description: ['', [Validators.required]],
    canDeliver: [false]
  });

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = () => {
        this.imagePreview = reader.result as string;
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    }
  }

  onSubmit() {
    if (this.venueForm.invalid || !this.selectedFile) {
      this.errorMessage = 'Заполните все поля и выберите фото';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const formData = new FormData();
    const formValue = this.venueForm.getRawValue();

    const venueData = {
      name: formValue.name,
      address: formValue.address,
      description: formValue.description,
      canDeliver: !!formValue.canDeliver
    };

    const venueBlob = new Blob([JSON.stringify(venueData)], {
      type: 'application/json'
    });

    formData.append('venueRequest', venueBlob);
    formData.append('image', this.selectedFile);

    this.http.post(`${environment.apiUrl}/venues/manage`, formData).subscribe({
      next: () => {
        this.isLoading = false;
        this.router.navigate(['/profile']);
      },
      error: (err) => {
        this.isLoading = false;
        console.error('SQL Error details:', err.error);
        this.errorMessage = err.error?.message || 'Ошибка при сохранении в базу данных';
        this.cdr.detectChanges();
      }
    });
  }
}