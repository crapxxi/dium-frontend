import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Venue, Product, ModifierGroup, Modifier, FulfillmentType } from '../../models/api.models';
import { CartService } from '../../services/cart.service';
import { Subscription, finalize, forkJoin } from 'rxjs';
import { environment } from '../../../environments/environment';
import { TranslateModule } from '@ngx-translate/core';


@Component({
  selector: 'app-venue-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './venue-detail.component.html'
})
export class VenueDetailComponent implements OnInit, OnDestroy {
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

  /** Самовывоз или доставка — выбор покупателя для всего заказа (хранится в корзине). */
  fulfillment: FulfillmentType | null = null;
  /** Окно «Как получить заказ?» при первом добавлении товара. */
  showFulfillmentDialog = false;
  private pendingProduct: Product | null = null;
  private fulfillmentSub?: Subscription;

  ngOnInit() {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id) this.loadAllData(id);
    });
    this.fulfillmentSub = this.cartService.fulfillment$.subscribe(type => {
      this.fulfillment = type;
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy() {
    this.fulfillmentSub?.unsubscribe();
  }

  /** Корзина пуста или из этого заведения — тогда выбор способа получения относится к нему. */
  get cartIsHere(): boolean {
    const cartVenueId = this.cartService.cartVenueId;
    return cartVenueId === null || cartVenueId === this.venue?.id;
  }

  get canDeliver(): boolean {
    return !!this.venue?.canDeliver;
  }

  /** Переключатель над меню и в окне товара. */
  setFulfillment(type: FulfillmentType) {
    if (type === 'DELIVERY' && !this.canDeliver) return;
    this.cartService.setFulfillment(type);
  }

  /** Выбор в окне «Как получить заказ?»: после него товар добавляется, как и хотел покупатель. */
  chooseFulfillment(type: FulfillmentType) {
    this.setFulfillment(type);
    this.showFulfillmentDialog = false;
    const product = this.pendingProduct;
    this.pendingProduct = null;
    if (product) this.addProduct(product);
  }

  closeFulfillmentDialog() {
    this.showFulfillmentDialog = false;
    this.pendingProduct = null;
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
        
        this.products = result.products
          .map(p => ({
            ...p,
            venueId: Number(id),
            canDeliver: this.venue?.canDeliver || false
          }))
          .sort((a, b) => {
            if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;

            const categoryOrder: { [key: string]: number } = { 'FOOD': 1, 'DRINK': 2 };
            const orderA = categoryOrder[a.category] || 3;
            const orderB = categoryOrder[b.category] || 3;
            if (orderA !== orderB) return orderA - orderB;

            return a.name.localeCompare(b.name);
          });

        this.applyFilter(this.currentCategory);
      }
    });
  }

  applyFilter(category: string) {
    this.currentCategory = category;
    
    if (category === 'all') {

      this.filteredProducts = [...this.products];
    } else {
      this.filteredProducts = this.products
        .filter(p => p.category.toLowerCase() === category.toLowerCase())
        .sort((a, b) => {
          if (a.inStock !== b.inStock) return a.inStock ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
    }
  }


  handleProductClick(product: Product) {
    if (!product.inStock) return;
    // Товары из другого заведения: сначала спрашиваем, очистить ли корзину
    if (!this.cartService.prepareForVenue(product.venueId)) return;

    if (!this.canDeliver) {
      // Заведение не доставляет — выбирать нечего
      if (this.cartService.fulfillmentValue !== 'PICKUP') this.cartService.setFulfillment('PICKUP');
    } else if (!this.cartService.fulfillmentValue) {
      this.pendingProduct = product;
      this.showFulfillmentDialog = true;
      return;
    }
    this.addProduct(product);
  }

  private addProduct(product: Product) {
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
      this.cartService.removeFromCart(product);
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

}