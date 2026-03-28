import { Component, OnInit, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Venue, Product, ModifierGroup, Modifier } from '../../models/api.models';
import { CartService } from '../../services/cart.service';
import { finalize, forkJoin } from 'rxjs';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-venue-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './venue-detail.component.html'
})
export class VenueDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private http = inject(HttpClient);
  private cdr = inject(ChangeDetectorRef);
  public cartService = inject(CartService);

  venue: Venue | null = null;
  products: Product[] = [];
  filteredProducts: Product[] = [];
  currentCategory: string = 'all';
  isLoading = true;

  showModifierModal = false;
  selectedProduct: Product | null = null;
  modifierGroups: ModifierGroup[] = [];
  selectedModifiers: Modifier[] = [];
  isModifiersLoading = false;
  
  selectedQuantity: number = 1;

  simpleCartQuantities: { [productId: number]: number } = {};

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) this.loadAllData(id);
    });
  }

  loadAllData(id: string) {
    this.isLoading = true;
    forkJoin({
      venue: this.http.get<Venue>(`${environment.apiUrl}/venues/${id}`),
      products: this.http.get<Product[]>(`${environment.apiUrl}/products/venue/${id}`)
    }).pipe(
      finalize(() => {
        this.isLoading = false;
        this.cdr.detectChanges();
      })
    ).subscribe({
      next: (result) => {
        this.venue = result.venue;
        this.products = result.products.map(p => ({
          ...p,
          venueId: Number(id),
          canDeliver: this.venue?.canDeliver || false
        }));
        this.applyFilter(this.currentCategory);
      }
    });
  }


  handleProductClick(product: Product) {
    if (!product.inStock) return;

    if (product.hasModifiers) {
      this.openModifiers(product);
    } else {
      this.cartService.addToCart(product, []);
      this.simpleCartQuantities[product.id] = 1;
    }
  }

  increaseSimpleQty(product: Product, event: Event) {
    event.stopPropagation();
    this.cartService.addToCart(product, []);
    this.simpleCartQuantities[product.id]++;
  }

  decreaseSimpleQty(product: Product, event: Event) {
    event.stopPropagation();
    if (this.simpleCartQuantities[product.id] > 0) {
      this.simpleCartQuantities[product.id]--;
    }
  }


  private openModifiers(product: Product) {
    this.selectedProduct = product;
    this.selectedModifiers = [];
    this.selectedQuantity = 1;
    this.showModifierModal = true;
    this.isModifiersLoading = true;

    this.http.get<ModifierGroup[]>(`${environment.apiUrl}/products/${product.id}/modifier-groups`)
      .pipe(finalize(() => {
        this.isModifiersLoading = false;
        this.cdr.detectChanges();
      }))
      .subscribe(groups => {
        this.modifierGroups = groups;
      });
  }

  toggleModifier(group: ModifierGroup, modifier: Modifier) {
    const index = this.selectedModifiers.findIndex(m => m.id === modifier.id);
    
    if (index > -1) {
      this.selectedModifiers.splice(index, 1);
    } else {
      const countInGroup = this.selectedModifiers.filter(m => 
        group.modifiers.some(gm => gm.id === m.id)
      ).length;

      if (countInGroup < group.maxChoices) {
        this.selectedModifiers.push(modifier);
      } else if (group.maxChoices === 1) {
        const groupIds = group.modifiers.map(gm => gm.id);
        this.selectedModifiers = this.selectedModifiers.filter(m => !groupIds.includes(m.id));
        this.selectedModifiers.push(modifier);
      }
    }
  }

  isModifierSelected(modifierId: number): boolean {
    return this.selectedModifiers.some(m => m.id === modifierId);
  }

  increaseModalQty() {
    this.selectedQuantity++;
  }

  decreaseModalQty() {
    if (this.selectedQuantity > 1) this.selectedQuantity--;
  }

  isGroupValid(group: ModifierGroup): boolean {
    if (!group.required) return true;
    const min = group.minChoices && group.minChoices > 0 ? group.minChoices : 1;
    const selectedCount = this.selectedModifiers.filter(m => 
      group.modifiers.some(gm => gm.id === m.id)
    ).length;
    return selectedCount >= min;
  }

  isModalValid(): boolean {
    if (!this.modifierGroups || this.modifierGroups.length === 0) return true;
    return this.modifierGroups.every(group => this.isGroupValid(group));
  }

  confirmAddToCart() {
    if (this.selectedProduct && this.isModalValid()) {
      for (let i = 0; i < this.selectedQuantity; i++) {
        this.cartService.addToCart(this.selectedProduct, [...this.selectedModifiers]);
      }
      this.closeModal();
    }
  }

  closeModal() {
    this.showModifierModal = false;
    this.selectedProduct = null;
    this.modifierGroups = [];
  }

  applyFilter(category: string) {
    this.currentCategory = category;
    this.filteredProducts = category === 'all' 
      ? this.products 
      : this.products.filter(p => p.category.toLowerCase() === category.toLowerCase());
  }
}