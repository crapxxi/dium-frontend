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
    paymentFrom: string | null;
    paymentMethod: PaymentMethod;
    /** Сколько баллов списано; null — оплата Kaspi. */
    pointsSpent: number | null;
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

  /** Как покупатель получает заказ: сам забирает или привозит студент-курьер. */
  export type FulfillmentType = 'PICKUP' | 'DELIVERY';

  export interface OrderRequest {
    venueId: number;
    items: OrderItemRequest[];
    address: string | null;
    comment: string;
    paymentFrom?: string;
    fulfillment: FulfillmentType;
    paymentMethod: PaymentMethod;
  }

  /** Kaspi — перевод заведению; POINTS — баллами из кошелька (цена с наценкой). */
  export type PaymentMethod = 'KASPI' | 'POINTS';

  export type WalletTransactionType = 'DELIVERY_EARNING' | 'ORDER_PAYMENT' | 'ORDER_REFUND' | 'ADMIN_ADJUSTMENT';

  export interface WalletTransaction {
    id: number;
    /** Плюс — начисление, минус — списание. */
    amount: number;
    balanceAfter: number;
    type: WalletTransactionType;
    orderId: number | null;
    note: string | null;
    createdAt: string;
  }

  export interface Wallet {
    balance: number;
    /** На сколько процентов цена в баллах выше цены в тенге. */
    markupPercent: number;
    pointsPerDelivery: number;
    transactions: WalletTransaction[];
  }

  export interface AdminWallet {
    userId: number;
    name: string;
    phone: string;
    role: string;
    balance: number;
    /** Сумма журнала; должна совпадать с балансом. */
    ledgerSum: number;
    transactions: WalletTransaction[];
  }

  export interface VenueSettlement {
    venueId: number;
    venueName: string;
    deliveryFeesOwed: number;
    pointsOrdersCount: number;
    pointsOrdersValue: number;
    /** Плюс — платформа платит заведению, минус — заведение платформе. */
    netToVenue: number;
  }

  export interface SettlementReport {
    from: string;
    to: string;
    venues: VenueSettlement[];
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

  // ───────────────────────── Доставка ─────────────────────────

  export type OrderStatus = 'PENDING' | 'PREPARING' | 'READY' | 'COMPLETED' | 'CANCELLED';
  export type DeliveryStatus = 'SEARCHING_COURIER' | 'ASSIGNED' | 'PICKED_UP' | 'DELIVERED' | 'CANCELLED';
  export type DeliveryIssueType =
    | 'NOT_DELIVERED'
    | 'COURIER_NOT_ARRIVED'
    | 'CUSTOMER_UNREACHABLE'
    | 'CUSTOMER_REFUSES_CODE'
    | 'DAMAGED_OR_WRONG'
    | 'CODE_LOCKED'
    | 'OTHER';
  export type DeliveryIssueStatus = 'OPEN' | 'RESOLVED';
  export type DeliveryParticipant = 'CUSTOMER' | 'COURIER' | 'VENUE' | 'SYSTEM';

  /** Свободный заказ в ленте курьера (данных клиента нет). */
  export interface AvailableDelivery {
    id: number;
    orderId: number;
    venueName: string;
    venueAddress: string | null;
    deliveryAddress: string;
    itemsCount: number;
    courierFee: number;
    orderStatus: OrderStatus;
    createdAt: string;
  }

  /** Доставка глазами курьера. pickupCode есть только до получения заказа в заведении. */
  export interface CourierDelivery {
    id: number;
    orderId: number;
    status: DeliveryStatus;
    orderStatus: OrderStatus;
    venueName: string;
    venueAddress: string | null;
    deliveryAddress: string;
    customerName: string;
    customerPhone: string | null;
    comment: string | null;
    items: OrderItemResponse[];
    courierFee: number;
    pickupCode: string | null;
    deliveryAttemptsLeft: number;
    deliveryCodeLocked: boolean;
    assignedAt: string | null;
    pickedUpAt: string | null;
    deliveredAt: string | null;
    /** Срок текущего этапа; null — срока нет. */
    deadlineAt: string | null;
  }

  export interface CourierSummary {
    deliveredCount: number;
    totalEarned: number;
    feePerDelivery: number;
    activeCount: number;
    maxActive: number;
  }

  /** Доставка глазами клиента. deliveryCode — код, который клиент называет курьеру при получении. */
  export interface CustomerDelivery {
    id: number;
    orderId: number;
    status: DeliveryStatus;
    venueName: string;
    courierName: string | null;
    courierPhone: string | null;
    deliveryCode: string | null;
    createdAt: string;
    assignedAt: string | null;
    pickedUpAt: string | null;
    deliveredAt: string | null;
    /** Срок текущего этапа; null — срока нет. */
    deadlineAt: string | null;
  }

  /** Доставка глазами заведения (без кодов). */
  export interface VenueDelivery {
    id: number;
    orderId: number;
    status: DeliveryStatus;
    orderStatus: OrderStatus;
    deliveryAddress: string;
    courierName: string | null;
    courierPhone: string | null;
    pickupAttemptsLeft: number;
    pickupCodeLocked: boolean;
    createdAt: string;
    assignedAt: string | null;
    pickedUpAt: string | null;
    deliveredAt: string | null;
    cancelledAt: string | null;
  }

  export interface AdminDelivery {
    id: number;
    orderId: number;
    status: DeliveryStatus;
    orderStatus: OrderStatus;
    venueName: string;
    deliveryAddress: string;
    orderTotal: number;
    courierFee: number;
    customerName: string;
    customerPhone: string;
    courierName: string | null;
    courierPhone: string | null;
    pickupCodeAttempts: number;
    deliveryCodeAttempts: number;
    codeLocked: boolean;
    hasOpenIssue: boolean;
    adminNote: string | null;
    createdAt: string;
    assignedAt: string | null;
    pickedUpAt: string | null;
    deliveredAt: string | null;
    cancelledAt: string | null;
    /** Срок текущего этапа; null — срока нет. */
    deadlineAt: string | null;
  }

  export interface DeliveryIssue {
    id: number;
    deliveryId: number;
    orderId: number;
    deliveryStatus: DeliveryStatus;
    type: DeliveryIssueType;
    status: DeliveryIssueStatus;
    reportedBy: DeliveryParticipant;
    reporterName: string | null;
    reporterPhone: string | null;
    description: string | null;
    resolution: string | null;
    resolvedByName: string | null;
    createdAt: string;
    resolvedAt: string | null;
  }

  export type AdminDeliveryAction = 'reassign' | 'cancel' | 'complete' | 'unlock';
