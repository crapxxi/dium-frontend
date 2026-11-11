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

  export type TwoFactorMethod = 'WHATSAPP' | 'TOTP';
  /** Чем подтверждается действие: кодом из WhatsApp, из приложения-аутентификатора или резервным кодом. */
  export type TwoFactorCodeType = TwoFactorMethod | 'BACKUP_CODE';

  /**
   * Ответ /auth/login, /auth/activate и /auth/2fa/verify.
   * Если twoFactorRequired === true, token пустой: вход нужно завершить кодом через /auth/2fa/verify.
   */
  export interface AuthResponse {
    token: string | null;
    phone: string;
    twoFactorRequired?: boolean;
    /** Временный токен (5 минут), принимается только эндпоинтами /auth/2fa/verify */
    tempToken?: string | null;
    twoFactorMethod?: TwoFactorMethod | null;
    availableMethods?: TwoFactorMethod[] | null;
    /** WhatsApp: удалось ли отправить код сразу при входе */
    codeSent?: boolean | null;
    backupCodesAvailable?: boolean | null;
  }

  /** Незавершённый вход, который ждёт код второго фактора (хранится в sessionStorage). */
  export interface PendingTwoFactor {
    tempToken: string;
    phone: string;
    method: TwoFactorMethod;
    availableMethods: TwoFactorMethod[];
    codeSent: boolean;
    backupCodesAvailable: boolean;
    /** Время истечения временного токена, мс */
    expiresAt: number;
  }

  export interface TwoFactorStatus {
    enabled: boolean;
    method: TwoFactorMethod | null;
    /** 2FA обязательна для роли (ADMIN, VENUE_OWNER) */
    required: boolean;
    /** Способ, который фактически используется при входе */
    loginMethod: TwoFactorMethod | null;
    backupCodesLeft: number;
  }

  export interface TwoFactorSetupResponse {
    method: TwoFactorMethod;
    secret: string | null;
    otpauthUri: string | null;
    qrCodeDataUri: string | null;
  }

  export interface BackupCodesResponse {
    backupCodes: string[];
  }

  /** Формат ошибок бэкенда (GlobalExceptionHandler). */
  export interface ApiError {
    status: number;
    message: string;
    timestamp: number;
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