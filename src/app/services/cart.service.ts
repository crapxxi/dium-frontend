import { Injectable, inject, PLATFORM_ID, Injector } from '@angular/core';
import { BehaviorSubject, map, Observable, throwError, combineLatest } from 'rxjs';
import { Product, CartItem, OrderRequest, OrderItemRequest, Modifier, Venue } from '../models/api.models';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import type { AuthService } from './auth.service'; 
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class CartService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private injector = inject(Injector);

  private cartItems = new BehaviorSubject<CartItem[]>([]);
  public items$ = this.cartItems.asObservable();
  
  private currentVenue = new BehaviorSubject<Venue | null>(null);
  public currentVenue$ = this.currentVenue.asObservable();

  private isDeliveryMode = new BehaviorSubject<boolean>(false);
  public isDeliveryMode$ = this.isDeliveryMode.asObservable();

  private get authService(): AuthService {
    const { AuthService } = require('./auth.service'); 
    return this.injector.get(AuthService);
  }
  public itemCount$ = this.items$.pipe(
    map(items => items.length)
  );

  public deliveryFee$ = combineLatest([this.currentVenue$, this.isDeliveryMode$]).pipe(
    map(([venue, isDelivery]) => (isDelivery && venue) ? (venue.deliveryPrice || 0) : 0)
  );

  public totalPrice$ = combineLatest([this.items$, this.deliveryFee$]).pipe(
    map(([items, fee]) => {
      const productsTotal = items.reduce((acc, item) => {
        const modsSum = item.selectedModifiers?.reduce((sum, m) => sum + m.priceDelta, 0) || 0;
        return acc + (item.price + modsSum) * item.count;
      }, 0);
      return productsTotal + fee;
    })
  );

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      const savedCart = localStorage.getItem('cart');
      if (savedCart) {
        try {
          const items = JSON.parse(savedCart);
          this.cartItems.next(items);
          if (items.length > 0) this.loadVenueInfo(items[0].venueId);
        } catch (e) {
          localStorage.removeItem('cart');
        }
      }
    }
  }

  private loadVenueInfo(venueId: number) {
    this.http.get<Venue>(`${environment.apiUrl}/venues/${venueId}`).subscribe({
      next: (venue) => this.currentVenue.next(venue),
      error: () => console.error('Venue load failed')
    });
  }

  setDeliveryMode(status: boolean) {
    this.isDeliveryMode.next(status);
  }

  addToCart(product: Product, selectedModifiers: Modifier[] = []) {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }

    let items = [...this.cartItems.value];

    if (items.length > 0 && items[0].venueId !== product.venueId) {
      if (confirm('В корзине товары из другого заведения. Очистить?')) {
        this.clearCart();
        items = [];
      } else return;
    }

    if (items.length === 0) this.loadVenueInfo(product.venueId);

    const getModKey = (mods: Modifier[]) => mods.map(m => m.id).sort().join(',');
    const newModKey = getModKey(selectedModifiers);
    const existingIndex = items.findIndex(item => 
      item.id === product.id && getModKey(item.selectedModifiers || []) === newModKey
    );

    if (existingIndex > -1) {
      items[existingIndex] = { ...items[existingIndex], count: items[existingIndex].count + 1 };
    } else {
      items.push({ ...product, count: 1, selectedModifiers: [...selectedModifiers] } as CartItem);
    }

    this.updateCart(items);
  }

  removeFromCart(product: Product, selectedModifiers: Modifier[] = []) {
    const getModKey = (mods: Modifier[]) => mods.map(m => m.id).sort().join(',');
    const modKey = getModKey(selectedModifiers);

    const updated = this.cartItems.value.map(item => {
      if (item.id === product.id && getModKey(item.selectedModifiers || []) === modKey) {
        return { ...item, count: item.count - 1 };
      }
      return item;
    }).filter(i => i.count > 0);

    if (updated.length === 0) {
      this.currentVenue.next(null);
      this.isDeliveryMode.next(false);
    }
    this.updateCart(updated);
  }

  clearItem(itemToRemove: CartItem) {
    const updated = this.cartItems.value.filter(i => i !== itemToRemove);
    if (updated.length === 0) {
      this.currentVenue.next(null);
      this.isDeliveryMode.next(false);
    }
    this.updateCart(updated);
  }

  clearCart() {
    this.updateCart([]);
    this.isDeliveryMode.next(false);
    this.currentVenue.next(null);
  }

  private updateCart(items: CartItem[]) {
    this.cartItems.next(items);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('cart', JSON.stringify(items));
    }
  }

  checkout(address: string | null, comment: string = ''): Observable<any> {
    const items = this.cartItems.value;
    const venue = this.currentVenue.value;
    if (items.length === 0) return throwError(() => new Error('Empty cart'));

    const isDelivery = !!address;
    const fee = (isDelivery && venue) ? (venue.deliveryPrice || 0) : 0;

    const orderRequest: OrderRequest = {
      venueId: items[0].venueId,
      address,
      comment,
      items: items.map(item => ({
        productId: item.id,
        count: item.count,
        modifierIds: item.selectedModifiers?.map(m => m.id) || []
      }))
    };

    return this.http.post(`${environment.apiUrl}/orders`, orderRequest);
  }

  getItems() { return this.cartItems.value; }
}