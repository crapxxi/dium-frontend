import { Component, OnDestroy, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, Subscription, catchError, forkJoin, interval, map, of, startWith, switchMap } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { DeliveryService } from '../../services/delivery.service';
import {
  AvailableDelivery,
  CourierDelivery,
  CourierSummary,
  CustomerDelivery,
  DeliveryIssueType,
  DeliveryStatus,
} from '../../models/api.models';
import { apiErrorMessage } from '../../utils/http-error';
import { DELIVERY_STEPS, ISSUE_TYPES, IssueFormState, IssueReporter, stepIndex } from './delivery-shared';

type Tab = 'available' | 'mine' | 'incoming';

/**
 * Вкладка «Доставка» для студентов. Студент здесь и курьер (берёт свободные заказы и получает
 * оплату за каждый), и заказчик (видит, кто везёт его заказ, и свой код для получения).
 */
@Component({
  selector: 'app-delivery',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './delivery.component.html',
})
export class DeliveryComponent implements OnInit, OnDestroy {
  private deliveryService = inject(DeliveryService);
  private authService = inject(AuthService);
  private platformId = inject(PLATFORM_ID);

  readonly steps = DELIVERY_STEPS;
  readonly issueTypes = ISSUE_TYPES;
  readonly stepIndex = stepIndex;

  readonly user = toSignal(this.authService.currentUser$, { initialValue: this.authService.currentUserValue });
  /** Курьерами работают только студенты (роль CLIENT). Остальным доступна только вкладка «Мне везут». */
  readonly isStudent = computed(() => this.user()?.role === 'CLIENT');

  readonly tab = signal<Tab>(this.authService.currentUserValue?.role === 'CLIENT' ? 'available' : 'incoming');
  readonly loading = signal(true);
  readonly available = signal<AvailableDelivery[]>([]);
  readonly mine = signal<CourierDelivery[]>([]);
  readonly incoming = signal<CustomerDelivery[]>([]);
  readonly summary = signal<CourierSummary | null>(null);

  readonly busyId = signal<number | null>(null);
  readonly errorMessage = signal('');
  readonly infoMessage = signal('');
  /** Введённые коды клиента по id доставки. */
  readonly codes = signal<Record<number, string>>({});
  readonly issueForm = signal<IssueFormState | null>(null);

  readonly activeMine = computed(() => this.mine().filter((d) => d.status === 'ASSIGNED' || d.status === 'PICKED_UP'));
  readonly finishedMine = computed(() => this.mine().filter((d) => d.status === 'DELIVERED' || d.status === 'CANCELLED'));
  readonly activeIncoming = computed(() => this.incoming().filter((d) => isActive(d.status)));
  readonly limitReached = computed(() => {
    const s = this.summary();
    return !!s && s.activeCount >= s.maxActive;
  });

  private refreshSub?: Subscription;

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) {
      this.loading.set(false);
      return;
    }
    // Пользователь может подгрузиться позже (после /auth/me) — опрос сам начнёт загрузку, когда он появится
    this.refreshSub = interval(10000)
      .pipe(startWith(0), switchMap(() => (this.user() ? this.loadAll() : of(undefined))))
      .subscribe(() => this.loading.set(false));
  }

  ngOnDestroy() {
    this.refreshSub?.unsubscribe();
  }

  setTab(tab: Tab) {
    this.tab.set(tab);
    this.clearMessages();
  }

  refresh() {
    this.loadAll().subscribe();
  }

  // ───────────────────────── курьер ─────────────────────────

  accept(delivery: AvailableDelivery) {
    this.run(delivery.id, this.deliveryService.accept(delivery.id), 'DELIVERY.MSG_ACCEPTED', () => this.setTab('mine'));
  }

  release(delivery: CourierDelivery) {
    this.run(delivery.id, this.deliveryService.release(delivery.id), 'DELIVERY.MSG_RELEASED');
  }

  onCodeInput(deliveryId: number, event: Event) {
    const input = event.target as HTMLInputElement;
    const value = input.value.replace(/\D/g, '').slice(0, 8);
    input.value = value;
    this.codes.update((codes) => ({ ...codes, [deliveryId]: value }));
    this.errorMessage.set('');
  }

  codeFor(deliveryId: number): string {
    return this.codes()[deliveryId] ?? '';
  }

  confirmDelivered(delivery: CourierDelivery) {
    const code = this.codeFor(delivery.id);
    if (code.length < 4) return;
    this.run(delivery.id, this.deliveryService.confirmDelivered(delivery.id, code), 'DELIVERY.MSG_DELIVERED', () =>
      this.codes.update((codes) => ({ ...codes, [delivery.id]: '' })),
    );
  }

  // ───────────────────────── проблемы ─────────────────────────

  openIssue(deliveryId: number, reporter: IssueReporter) {
    this.clearMessages();
    this.issueForm.set({ deliveryId, reporter, type: null, description: '' });
  }

  closeIssue() {
    this.issueForm.set(null);
  }

  setIssueType(type: DeliveryIssueType) {
    this.issueForm.update((form) => (form ? { ...form, type } : form));
  }

  setIssueDescription(event: Event) {
    const description = (event.target as HTMLTextAreaElement).value;
    this.issueForm.update((form) => (form ? { ...form, description } : form));
  }

  sendIssue() {
    const form = this.issueForm();
    if (!form?.type) return;
    this.run(
      form.deliveryId,
      this.deliveryService.reportIssue(form.deliveryId, form.type, form.description.trim()),
      'DELIVERY.MSG_ISSUE_SENT',
      () => this.issueForm.set(null),
    );
  }

  // ───────────────────────── общее ─────────────────────────

  private run(id: number, request: Observable<unknown>, successKey: string, after?: () => void) {
    if (this.busyId() !== null) return;
    this.busyId.set(id);
    this.clearMessages();
    request.subscribe({
      next: () => {
        this.busyId.set(null);
        after?.();
        this.infoMessage.set(successKey);
        this.refresh();
      },
      error: (err: unknown) => {
        this.busyId.set(null);
        this.errorMessage.set(apiErrorMessage(err, 'DELIVERY.ERR_GENERIC'));
        this.refresh();
      },
    });
  }

  /** Загружает все списки; ошибка одного запроса не обнуляет уже показанные данные. */
  private loadAll(): Observable<void> {
    const safe = <T>(request: Observable<T>, fallback: T) => request.pipe(catchError(() => of(fallback)));

    const customer$ = safe(this.deliveryService.getCustomerDeliveries(), this.incoming());
    if (!this.isStudent()) {
      this.tab.set('incoming');
      return customer$.pipe(map((incoming) => this.incoming.set(incoming)));
    }
    return forkJoin({
      available: safe(this.deliveryService.getAvailable(), this.available()),
      mine: safe(this.deliveryService.getCourierDeliveries(), this.mine()),
      summary: safe(this.deliveryService.getCourierSummary(), this.summary()),
      incoming: customer$,
    }).pipe(
      map((result) => {
        this.available.set(result.available);
        this.mine.set(result.mine);
        this.summary.set(result.summary);
        this.incoming.set(result.incoming);
      }),
    );
  }

  private clearMessages() {
    this.errorMessage.set('');
    this.infoMessage.set('');
  }

  phoneHref(phone: string | null): string {
    return phone ? `tel:+${phone.replace(/\D/g, '')}` : '';
  }

  isActive(status: DeliveryStatus) {
    return isActive(status);
  }
}

function isActive(status: DeliveryStatus): boolean {
  return status === 'SEARCHING_COURIER' || status === 'ASSIGNED' || status === 'PICKED_UP';
}
