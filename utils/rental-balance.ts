import type { RentalPaymentChange } from '~/types/rental'
import { CANCELLED_RENTAL_STATUSES } from './constants'
import { fromMinorUnits, toMinorUnits } from './currency'
import { isRefundPayment, paymentKind } from './payment'
import { paidPaymentChange, paymentCollectedDeposit } from './rental'
import { separatelyBilledExtensionTotal } from './rental-extension'

export interface BalancePaymentRow {
  amount: number | string
  status: string
  paid_at: string | null
  created_at: string
  metadata?: unknown
}

export interface BalanceExtensionRow {
  uuid: string
  added_amount: number | string
  created_at: string
  cancelled_at?: string | null
}

/** The booking's own payment: the earliest paid one that is not an extension, late fee, balance or refund. */
export function mainPaidPayment<T extends BalancePaymentRow>(payments: T[]): T | null {
  return payments
    .filter(payment => payment.status === 'paid' && paymentKind(payment.metadata) === 'booking')
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))[0] ?? null
}

/** The deposit a booking payment still holds, or null when its metadata does not say. */
export function paymentHeldDeposit(metadata: unknown): number | null {
  if (!paymentCollectedDeposit(metadata)) {
    return null
  }
  const value = Number((metadata as { depositAmount?: unknown }).depositAmount)
  return Number.isFinite(value) ? Math.max(0, value) : null
}

/**
 * Rent still to collect or to give back on a paid booking.
 * Paid so far is the booking payment, plus balances marked paid, minus refunds marked given.
 * Null when the booking has no paid booking payment or was cancelled: nothing is open then.
 */
export function rentalPaymentBalance(input: {
  status: string
  totalAmount: number
  depositAmount: number
  payments: BalancePaymentRow[]
  extensions: BalanceExtensionRow[]
}): RentalPaymentChange | null {
  if ((CANCELLED_RENTAL_STATUSES as readonly string[]).includes(input.status)) {
    return null
  }

  const main = mainPaidPayment(input.payments)
  if (!main) {
    return null
  }

  const settled = input.payments.reduce((sum, payment) => {
    if (payment.status === 'paid' && paymentKind(payment.metadata) === 'balance') {
      return sum + toMinorUnits(Number(payment.amount))
    }
    return isRefundPayment(payment) ? sum - toMinorUnits(Number(payment.amount)) : sum
  }, 0)

  return paidPaymentChange({
    paidAmount: fromMinorUnits(toMinorUnits(Number(main.amount)) + settled),
    includesDeposit: paymentCollectedDeposit(main.metadata),
    heldDeposit: paymentHeldDeposit(main.metadata) ?? undefined,
    totalAmount: input.totalAmount,
    depositAmount: input.depositAmount,
    billedSeparately: separatelyBilledExtensionTotal(input.extensions.map(extension => ({
      uuid: extension.uuid,
      createdAt: extension.created_at,
      addedAmount: Number(extension.added_amount),
      cancelled: Boolean(extension.cancelled_at),
    })), main.paid_at),
  })
}
