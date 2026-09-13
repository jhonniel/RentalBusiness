import type { RentalStatus } from './constants'
import { INVENTORY_OCCUPYING_RENTAL_STATUSES } from './constants'

export const RENTAL_TRANSITIONS: Record<RentalStatus, readonly RentalStatus[]> = {
  draft: ['pending', 'cancelled'],
  pending: ['awaiting_payment', 'approved', 'rejected', 'cancelled'],
  awaiting_payment: ['paid', 'cancelled'],
  paid: ['approved', 'cancelled'],
  approved: ['ready_for_pickup', 'cancelled'],
  ready_for_pickup: ['active', 'cancelled'],
  active: ['returned', 'overdue'],
  overdue: ['returned'],
  returned: ['completed'],
  completed: [],
  cancelled: [],
  rejected: [],
}

export function canTransitionRentalStatus(from: RentalStatus, to: RentalStatus): boolean {
  return RENTAL_TRANSITIONS[from].includes(to)
}

export function rentalOccupiesInventory(status: RentalStatus): boolean {
  return (INVENTORY_OCCUPYING_RENTAL_STATUSES as readonly string[]).includes(status)
}

export function datesOverlapInclusive(
  startA: string,
  endA: string,
  startB: string,
  endB: string,
): boolean {
  return startA <= endB && endA >= startB
}
