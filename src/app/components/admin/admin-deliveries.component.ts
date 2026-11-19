import { Component, OnDestroy, OnInit, PLATFORM_ID, computed, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { TranslateModule } from '@ngx-translate/core';
import { Observable, Subscription, catchError, forkJoin, interval, map, of, startWith, switchMap } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { DeliveryService } from '../../services/delivery.service';
import {
  AdminDelivery,
  AdminDeliveryAction,
  DeliveryIssue,
  DeliveryIssueStatus,
  DeliveryStatus,
} from '../../models/api.models';
import { apiErrorMessage } from '../../utils/http-error';

type Tab = 'issues' | 'deliveries';

interface ActionForm {
  deliveryId: number;
  action: AdminDeliveryAction;
  reason: string;
}

/** Админка доставки: все доставки, проблемы от участников и системы, ручное разрешение споров. */
@Component({
  selector: 'app-admin-deliveries',
  standalone: true,
  imports: [CommonModule, RouterLink, TranslateModule],
  templateUrl: './admin-deliveries.component.html',
})
export class AdminDeliveriesComponent implements OnInit, OnDestroy {
  private deliveryService = inject(DeliveryService);
  private authService = inject(AuthService);
  private platformId = inject(PLATFORM_ID);

  private readonly user = toSignal(this.authService.currentUser$, { initialValue: this.authService.currentUserValue });
  readonly isAdmin = computed(() => this.user()?.role === 'ADMIN');
  readonly statusFilters: (DeliveryStatus | null)[] = [null, 'SEARCHING_COURIER', 'ASSIGNED', 'PICKED_UP', 'DELIVERED', 'CANCELLED'];
  readonly issueFilters: (DeliveryIssueStatus | null)[] = ['OPEN', 'RESOLVED', null];

  readonly tab = signal<Tab>('issues');
  readonly loading = signal(true);
  readonly deliveries = signal<AdminDelivery[]>([]);
  readonly issues = signal<DeliveryIssue[]>([]);
  readonly statusFilter = signal<DeliveryStatus | null>(null);
  readonly issueFilter = signal<DeliveryIssueStatus | null>('OPEN');
  readonly openIssuesCount = signal(0);
  /** Доставка, к которой перешли из проблемы: показывается первой. */
  readonly focusId = signal<number | null>(null);

  readonly actionForm = signal<ActionForm | null>(null);
  readonly resolveForm = signal<{ issueId: number; resolution: string } | null>(null);
  readonly busy = signal(false);
  readonly errorMessage = signal('');
  readonly infoMessage = signal('');

  readonly sortedDeliveries = computed(() => {
    const focus = this.focusId();
    const list = this.deliveries();
    return focus === null ? list : [...list.filter((d) => d.id === focus), ...list.filter((d) => d.id !== focus)];
  });

  private refreshSub?: Subscription;

  ngOnInit() {
    if (!isPlatformBrowser(this.platformId)) {
      this.loading.set(false);
      return;
    }
    this.refreshSub = interval(15000)
      .pipe(startWith(0), switchMap(() => (this.isAdmin() ? this.load() : of(undefined))))
      .subscribe(() => this.loading.set(false));
  }

  ngOnDestroy() {
    this.refreshSub?.unsubscribe();
  }

  setTab(tab: Tab) {
    this.tab.set(tab);
    this.clearMessages();
  }

  setStatusFilter(status: DeliveryStatus | null) {
    this.statusFilter.set(status);
    this.focusId.set(null);
    this.refresh();
  }

  setIssueFilter(status: DeliveryIssueStatus | null) {
    this.issueFilter.set(status);
    this.refresh();
  }

  showDelivery(deliveryId: number) {
    this.statusFilter.set(null);
    this.focusId.set(deliveryId);
    this.setTab('deliveries');
    this.refresh();
  }

  refresh() {
    this.load().subscribe();
  }

  /** Какие действия имеют смысл в текущем статусе (сервер всё равно проверит). */
  actionsFor(d: AdminDelivery): AdminDeliveryAction[] {
    const actions: AdminDeliveryAction[] = [];
    if (d.status === 'ASSIGNED') actions.push('reassign');
    if ((d.status === 'ASSIGNED' || d.status === 'PICKED_UP') && d.orderStatus === 'READY') actions.push('complete');
    if (d.codeLocked && (d.status === 'ASSIGNED' || d.status === 'PICKED_UP')) actions.push('unlock');
    if (d.status === 'SEARCHING_COURIER' || d.status === 'ASSIGNED' || d.status === 'PICKED_UP') actions.push('cancel');
    return actions;
  }

  openAction(deliveryId: number, action: AdminDeliveryAction) {
    this.clearMessages();
    this.actionForm.set({ deliveryId, action, reason: '' });
  }

  setReason(event: Event) {
    const reason = (event.target as HTMLTextAreaElement).value;
    this.actionForm.update((form) => (form ? { ...form, reason } : form));
  }

  submitAction() {
    const form = this.actionForm();
    if (!form || !form.reason.trim()) return;
    this.run(this.deliveryService.adminAction(form.deliveryId, form.action, form.reason.trim()), 'ADMIN_DELIVERY.MSG_DONE', () =>
      this.actionForm.set(null),
    );
  }

  openResolve(issueId: number) {
    this.clearMessages();
    this.resolveForm.set({ issueId, resolution: '' });
  }

  setResolution(event: Event) {
    const resolution = (event.target as HTMLTextAreaElement).value;
    this.resolveForm.update((form) => (form ? { ...form, resolution } : form));
  }

  submitResolve() {
    const form = this.resolveForm();
    if (!form || !form.resolution.trim()) return;
    this.run(this.deliveryService.resolveIssue(form.issueId, form.resolution.trim()), 'ADMIN_DELIVERY.MSG_RESOLVED', () =>
      this.resolveForm.set(null),
    );
  }

  phoneHref(phone: string | null): string {
    return phone ? `tel:+${phone.replace(/\D/g, '')}` : '';
  }

  private run(request: Observable<unknown>, successKey: string, after: () => void) {
    if (this.busy()) return;
    this.busy.set(true);
    this.clearMessages();
    request.subscribe({
      next: () => {
        this.busy.set(false);
        after();
        this.infoMessage.set(successKey);
        this.refresh();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.errorMessage.set(apiErrorMessage(err, 'DELIVERY.ERR_GENERIC'));
      },
    });
  }

  private load(): Observable<void> {
    return forkJoin({
      deliveries: this.deliveryService.getAdminDeliveries(this.statusFilter()).pipe(catchError(() => of(this.deliveries()))),
      issues: this.deliveryService.getIssues(this.issueFilter()).pipe(catchError(() => of(this.issues()))),
      open: this.deliveryService.getIssues('OPEN').pipe(catchError(() => of(null))),
    }).pipe(
      map(({ deliveries, issues, open }) => {
        this.deliveries.set(deliveries);
        this.issues.set(issues);
        if (open) this.openIssuesCount.set(open.length);
      }),
    );
  }

  private clearMessages() {
    this.errorMessage.set('');
    this.infoMessage.set('');
  }
}
