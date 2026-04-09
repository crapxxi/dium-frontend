export interface User {
    phone: string;
    name: string;
    role: 'CLIENT' | 'VENUE_OWNER' | 'ADMIN';
    paymentFrom: string;
  }
  
  export interface Venue {
    id: number;
    name: string;
    description: string;
    address: string;
    imageUrl: string;
    canDeliver: boolean;
    kaspiUrl: string;
    deliveryPrice: number;
    isWorking: boolean;
  }

  export interface OrderModifierResponse {
    id: number;
    name: string;
    priceDelta: number;
  }
  
  export interface Product {
    id: number;
    name: string;
    price: number;
    imageUrl: string;
    description: string;
    category: string;
    venueId: number;
    inStock: boolean;
    hasModifiers: boolean;
    canDeliver: boolean;
    deliveryPrice?: number;
  }

  export interface OrderItemResponse {
    productId?: number;
    productName: string;
    count: number;
    priceAtPurchase: number;
    modifiers: OrderModifierResponse[];
  }
  
  export interface OrderResponse {
    id: number;
    venueName: string;
    totalSum: number;
    status: 'PENDING' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
    pickupCode: number;
    createdAt: string;
    items: OrderItemResponse[];
    address: string;
    comment: string;
    deliveryFee: number;
    paymentFrom: string;
  }

  export interface RegisterRequest {
    phone: string;
    name: string;
    password: string;
  }

  export interface OrderItemRequest {
    productId: number;
    count: number;
    modifierIds: number[];
  }

  export interface OrderRequest {
    venueId: number;
    items: OrderItemRequest[];
    address: string | null;
    comment: string;
    paymentFrom?: string;
  }

  export interface LoginRequest {
    phone: string;
    password: string;
  }

  export interface AuthResponse {
    token: string;
    phone: string;
  }

  export interface UserResponse {
    phone: string;
    name: string;
    role: 'CLIENT' | 'VENUE_OWNER' | 'ADMIN';
  }
  
  export interface CartItem extends Product {
    count: number;
    selectedModifiers: Modifier[];
    comment?: string; 
  }

  export interface Modifier {
    id: number;
    name: string;
    priceDelta: number;
    inStock: boolean;
  }

  export interface ModifierGroup {
    id: number;
    name: string;
    required: boolean;
    minChoices: number;
    maxChoices: number;
    modifiers: Modifier[];
  }