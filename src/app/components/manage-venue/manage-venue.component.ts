import { Component, inject, OnInit, ChangeDetectorRef, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators, FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Venue, Product, ModifierGroup, Modifier } from '../../models/api.models';
import { Subscription, of } from 'rxjs';
import { catchError, finalize, switchMap, take } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { TranslateModule } from '@ngx-translate/core';



@Component({
  selector: 'app-manage-venue',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, FormsModule, TranslateModule],
  templateUrl: './manage-venue.component.html'
})
export class ManageVenueComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);
  
  venue: Venue | null = null;
  products: Product[] = [];
  
  isLoading = true;
  isSaving = false;
  isAddingProduct = false;
  showSettings = false;
  showAddProductForm = false;
  isWorking = false;
  
  showModifierManager = false;
  selectedProduct: Product | null = null;
  modifierGroups: ModifierGroup[] = [];
  isModifiersLoading = false;

  newGroupDraft: any = this.getEmptyDraftGroup();

  selectedFile: File | null = null;
  imagePreview: string | null = null;

  selectedVenueFile: File | null = null;
  venueImagePreview: string | null = null;

  venueForm = this.fb.group({
    name: ['', [Validators.required]],
    address: ['', [Validators.required]],
    description: ['', [Validators.required]],
    kaspiUrl: [''],
    canDeliver: [false],
    deliveryPrice: [0],
    imageUrl: ['']
  });

  productForm = this.fb.group({
    name: ['', [Validators.required]],
    description: ['', [Validators.required]],
    price: [0, [Validators.required, Validators.min(0)]],
    category: ['FOOD', [Validators.required]],
    hasModifiers: [false, [Validators.required]]
  });

  private dataSub?: Subscription;

  ngOnInit() { 
    this.loadInitialData(); 
  }

  loadInitialData() {
    this.isLoading = true;
    
    const id = this.route.snapshot.paramMap.get('id');
    const venueUrl = id 
      ? `${environment.apiUrl}/venues/${id}` 
      : `${environment.apiUrl}/venues/manage/my`;
    
    this.dataSub = this.http.get<Venue>(venueUrl).pipe(
      switchMap(v => {
        this.venue = v;
        this.venueForm.patchValue(v);
        return this.http.get<Product[]>(`${environment.apiUrl}/products/venue/${v.id}`);
      }),
      catchError(err => {
        console.error('Ошибка при загрузке данных:', err);
        return of([] as Product[]);
      }),
      finalize(() => { 
        this.isLoading = false; 
        this.cdr.detectChanges(); 
      })
    ).subscribe(products => {
      this.products = products;
      this.cdr.detectChanges();
    });
  }

  onVenueFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedVenueFile = file;
      const reader = new FileReader();
      reader.onload = () => { 
        this.venueImagePreview = reader.result as string; 
        this.cdr.detectChanges(); 
      };
      reader.readAsDataURL(file);
    }
  }

  onUpdateVenue() {
    if (this.venueForm.invalid) return;
    this.isSaving = true;
  
    const formData = new FormData();
    

    const venueData = this.venueForm.getRawValue();
    
    const venueBlob = new Blob([JSON.stringify(venueData)], { 
      type: 'application/json' 
    });
    
    formData.append('venueRequest', venueBlob); 
  
    if (this.selectedVenueFile) {
      formData.append('image', this.selectedVenueFile);
    }
  
    this.http.put(`${environment.apiUrl}/venues/manage`, formData)
      .pipe(finalize(() => { 
        this.isSaving = false; 
        this.cdr.detectChanges(); 
      }))
      .subscribe({
        next: () => { 
          alert('Настройки заведения сохранены!'); 
          this.showSettings = false;
          this.loadInitialData(); 
        },
        error: (err) => { 
          console.error(err); 
          alert('Ошибка при сохранении заведения'); 
        }
      });
  }


  toggleStock(product: Product) {
    this.http.patch(`${environment.apiUrl}/products/${product.id}`, {})
      .subscribe({
        next: () => { product.inStock = !product.inStock; this.cdr.detectChanges(); },
        error: (err) => { console.error(err); alert('Не удалось изменить статус'); }
      });
  }

  deleteProduct(id: number) {
    if (!confirm('Вы действительно хотите удалить это блюдо?')) return;
    this.http.delete(`${environment.apiUrl}/products/${id}`)
      .subscribe({
        next: () => {
          this.products = this.products.filter(p => p.id !== id);
          this.cdr.detectChanges();
        },
        error: (err) => { console.error(err); alert('Не удалось удалить блюдо'); }
      });
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.selectedFile = file;
      const reader = new FileReader();
      reader.onload = () => { this.imagePreview = reader.result as string; this.cdr.detectChanges(); };
      reader.readAsDataURL(file);
    }
  }

  addProduct() {
    if (this.productForm.invalid || !this.selectedFile) return;
    this.isAddingProduct = true;
    const formData = new FormData();
    formData.append('productRequest', new Blob([JSON.stringify(this.productForm.getRawValue())], { type: 'application/json' }));
    formData.append('image', this.selectedFile);

    this.http.post<Product>(`${environment.apiUrl}/products/venue/products`, formData)
      .pipe(finalize(() => { this.isAddingProduct = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (newProduct) => {
          this.products.unshift(newProduct);
          this.showAddProductForm = false;
          this.productForm.reset({ category: 'FOOD', price: 0, hasModifiers: false });
          this.selectedFile = null;
          this.imagePreview = null;
        },
        error: (err) => { console.error(err); alert('Ошибка при создании блюда'); }
      });
  }


  openModifierManager(product: Product) {
    this.selectedProduct = product;
    this.showModifierManager = true;
    this.newGroupDraft = this.getEmptyDraftGroup();
    this.loadModifiers(product.id);
  }

  loadModifiers(productId: number) {
    this.isModifiersLoading = true;
    this.modifierGroups = []; 
    this.cdr.detectChanges();

    this.http.get<ModifierGroup[]>(`${environment.apiUrl}/products/${productId}/modifier-groups`)
      .pipe(finalize(() => { this.isModifiersLoading = false; this.cdr.detectChanges(); }))
      .subscribe({
        next: (groups) => this.modifierGroups = groups,
        error: (err) => { console.error(err); alert('Ошибка загрузки списка добавок'); }
      });
  }


  getEmptyDraftGroup() {
    return { name: '', required: false, minChoices: 0, maxChoices: 1, modifiers: [] };
  }

  addModifierToDraft(nameInp: HTMLInputElement, priceInp: HTMLInputElement) {
    const name = nameInp.value.trim();
    const price = Number(priceInp.value) || 0;
    if (name) {
      this.newGroupDraft.modifiers.push({ name, priceDelta: price, inStock: true });
      nameInp.value = '';
      priceInp.value = '0';
    }
  }

  removeModifierFromDraft(index: number) {
    this.newGroupDraft.modifiers.splice(index, 1);
  }

  saveDraftGroup() {
    if (!this.newGroupDraft.name.trim() || !this.selectedProduct) {
      alert('Пожалуйста, введите название категории!');
      return;
    }

    this.http.post<ModifierGroup>(`${environment.apiUrl}/products/${this.selectedProduct.id}/modifier-groups`, this.newGroupDraft)
      .subscribe({
        next: (newGroup) => {
          this.modifierGroups.push(newGroup);
          this.newGroupDraft = this.getEmptyDraftGroup();
          this.cdr.detectChanges();
        },
        error: (err) => { console.error(err); alert('Ошибка при сохранении новой категории'); }
      });
  }


  updateModifierGroup(group: ModifierGroup) {
    if (group.minChoices > group.maxChoices) group.minChoices = group.maxChoices;
    this.http.put(`${environment.apiUrl}/modifiers/groups/${group.id}`, group)
      .subscribe({
        next: () => this.cdr.detectChanges(),
        error: (err) => { console.error(err); alert('Не удалось обновить правила группы'); }
      });
  }

  toggleRequiredModifierGroup(group: ModifierGroup) {
    this.http.patch(`${environment.apiUrl}/modifiers/groups/${group.id}/toggleRequired`, {})
      .subscribe({
        next: () => {
          group.required = !group.required;
          this.cdr.detectChanges();
        },
        error: (err) => { console.error(err); alert('Ошибка при изменении статуса наличия'); }
      });
  }

  deleteModifierGroup(groupId: number) {
    if (!confirm('Точно удалить категорию со всеми добавками?')) return;
    this.http.delete(`${environment.apiUrl}/modifiers/groups/${groupId}`)
      .subscribe({
        next: () => {
          this.modifierGroups = this.modifierGroups.filter(g => g.id !== groupId);
          this.cdr.detectChanges();
        },
        error: (err) => { console.error(err); alert('Ошибка при удалении группы'); }
      });
  }

  addModifierToExistingGroup(group: ModifierGroup, nameInp: HTMLInputElement, priceInp: HTMLInputElement) {
    const name = nameInp.value.trim();
    const priceDelta = Number(priceInp.value) || 0;
    if (!name) return;

    const payload = { ...group };
    payload.modifiers = payload.modifiers ? [...payload.modifiers] : [];
    payload.modifiers.push({ name, priceDelta, inStock: true } as Modifier);

    this.http.put<ModifierGroup>(`${environment.apiUrl}/modifiers/groups/${group.id}`, payload)
      .subscribe({
        next: (updatedGroup) => {
          const index = this.modifierGroups.findIndex(g => g.id === group.id);
          if (index !== -1) this.modifierGroups[index] = updatedGroup;
          nameInp.value = ''; priceInp.value = '0';
          this.cdr.detectChanges();
        },
        error: (err) => { console.error(err); alert('Ошибка при добавлении опции'); }
      });
  }

  updateModifier(modifier: Modifier) {
    this.http.put(`${environment.apiUrl}/modifiers/${modifier.id}`, modifier)
      .subscribe({
        next: () => this.cdr.detectChanges(),
        error: (err) => { console.error(err); alert('Не удалось обновить добавку'); }
      });
  }

  toggleModifierStock(modifier: Modifier) {
    this.http.patch(`${environment.apiUrl}/modifiers/${modifier.id}`, {})
      .subscribe({
        next: () => {
          modifier.inStock = !modifier.inStock;
          this.cdr.detectChanges();
        },
        error: (err) => { console.error(err); alert('Ошибка при изменении статуса наличия'); }
      });
  }

  deleteModifier(modifierId: number, group: ModifierGroup) {
    this.http.delete(`${environment.apiUrl}/modifiers/${modifierId}`)
      .subscribe({
        next: () => {
          group.modifiers = group.modifiers.filter(m => m.id !== modifierId);
          this.cdr.detectChanges();
        },
        error: (err) => { console.error(err); alert('Ошибка при удалении опции'); }
      });
  }

  toggleWork() {
    if (!this.venue) return;
  
    
    this.http.patch(`${environment.apiUrl}/venues/manage/toggleWork`, {})
      .subscribe({
        next: () => {
          if (this.venue) {
            this.venue.isWorking = !this.venue.isWorking;
          }
          
          const statusText = this.venue?.isWorking ? 'открыто' : 'закрыто';
          console.log(`Заведение теперь ${statusText}`);
          
          this.cdr.detectChanges();
        },
        error: (err) => {
          console.error('Ошибка при переключении статуса:', err);
          alert('Не удалось изменить статус работы заведения. Попробуйте позже.');
          this.cdr.detectChanges();
        }
      });
  }

  ngOnDestroy() { 
    this.dataSub?.unsubscribe(); 
  }
}