import { DeliveryIssueType, DeliveryStatus } from '../../models/api.models';

/** Кто сообщает о проблеме — от этого зависит список причин. */
export type IssueReporter = 'CUSTOMER' | 'COURIER' | 'VENUE';

export interface IssueFormState {
  deliveryId: number;
  reporter: IssueReporter;
  type: DeliveryIssueType | null;
  description: string;
}

/** Причины, которые предлагаем каждой стороне (CODE_LOCKED создаёт только система). */
export const ISSUE_TYPES: Record<IssueReporter, DeliveryIssueType[]> = {
  CUSTOMER: ['NOT_DELIVERED', 'COURIER_NOT_ARRIVED', 'DAMAGED_OR_WRONG', 'OTHER'],
  COURIER: ['CUSTOMER_UNREACHABLE', 'CUSTOMER_REFUSES_CODE', 'DAMAGED_OR_WRONG', 'OTHER'],
  VENUE: ['COURIER_NOT_ARRIVED', 'OTHER'],
};

/** Шаги доставки для полоски прогресса. */
export const DELIVERY_STEPS: DeliveryStatus[] = ['SEARCHING_COURIER', 'ASSIGNED', 'PICKED_UP', 'DELIVERED'];

export function stepIndex(status: DeliveryStatus): number {
  return DELIVERY_STEPS.indexOf(status);
}
