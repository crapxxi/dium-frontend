import { Component, EventEmitter, Input, Output, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslateModule } from '@ngx-translate/core';
import { Observable } from 'rxjs';
import { DeliveryIssueType, VenueDelivery } from '../../models/api.models';
import { DeliveryService } from '../../services/delivery.service';
import { apiErrorMessage } from '../../utils/http-error';
import { ISSUE_TYPES, IssueFormState } from '../delivery/delivery-shared';

/**
 * Вкладка «Доставки» в кухне заведения: кто везёт заказы, передача заказа курьеру по его коду,
 * подтверждение, что заказ доставлен. Список загружает кухня и передаёт сюда.
 */
@Component({
  selector: 'app-venue-deliveries',
  standalone: true,
  imports: [CommonModule, TranslateModule],
  templateUrl: './venue-deliveries.component.html',
})
export class VenueDeliveriesComponent {
  private deliveryService = inject(DeliveryService);

  @Input({ required: true }) set deliveries(value: VenueDelivery[]) {
    this.list.set(value ?? []);
  }
  /** Что-то изменилось — кухня перезагрузит списки. */
  @Output() changed = new EventEmitter<void>();

  readonly issueTypes = ISSUE_TYPES;
  readonly list = signal<VenueDelivery[]>([]);
  readonly active = computed(() =>
    this.list().filter((d) => d.status === 'SEARCHING_COURIER' || d.status === 'ASSIGNED' || d.status === 'PICKED_UP'),
  );
  readonly finished = computed(() => this.list().filter((d) => d.status === 'DELIVERED' || d.status === 'CANCELLED'));

  readonly codes = signal<Record<number, string>>({});
  readonly busyId = signal<number | null>(null);
  readonly errorMessage = signal('');
  readonly infoMessage = signal('');
  readonly issueForm = signal<IssueFormState | null>(null);

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

  handOver(delivery: VenueDelivery) {
    const code = this.codeFor(delivery.id);
    if (code.length < 4) return;
    this.run(delivery.id, this.deliveryService.confirmPickup(delivery.id, code), 'DELIVERY.MSG_PICKED_UP', () =>
      this.codes.update((codes) => ({ ...codes, [delivery.id]: '' })),
    );
  }

  openIssue(deliveryId: number) {
    this.errorMessage.set('');
    this.infoMessage.set('');
    this.issueForm.set({ deliveryId, reporter: 'VENUE', type: null, description: '' });
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

  phoneHref(phone: string | null): string {
    return phone ? `tel:+${phone.replace(/\D/g, '')}` : '';
  }

  private run(id: number, request: Observable<unknown>, successKey: string, after?: () => void) {
    if (this.busyId() !== null) return;
    this.busyId.set(id);
    this.errorMessage.set('');
    this.infoMessage.set('');
    request.subscribe({
      next: () => {
        this.busyId.set(null);
        after?.();
        this.infoMessage.set(successKey);
        this.changed.emit();
      },
      error: (err: unknown) => {
        this.busyId.set(null);
        this.errorMessage.set(apiErrorMessage(err, 'DELIVERY.ERR_GENERIC'));
        this.changed.emit();
      },
    });
  }
}
