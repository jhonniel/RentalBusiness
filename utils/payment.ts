import type { PublicPayment } from '~/types/payment'
import type { Json } from '~/types/database.types'
import type { PaymentKind, PaymentStatus } from './constants'
import { SEPARATE_PAYMENT_KINDS } from './constants'

export const PAYMENT_TRANSITIONS: Record<PaymentStatus, readonly PaymentStatus[]> = {
  pending: ['processing', 'paid', 'failed', 'cancelled'],
  processing: ['paid', 'failed', 'cancelled'],
  paid: ['refunded', 'partially_refunded'],
  failed: [],
  cancelled: [],
  refunded: [],
  partially_refunded: ['refunded'],
}

export interface PaymentRow {
  uuid: string
  amount: number
  currency: string
  provider: string
  status: PaymentStatus
  payment_method: string | null
  paid_at: string | null
  metadata: Json
  created_at: string
}

export function canTransitionPaymentStatus(from: PaymentStatus, to: PaymentStatus): boolean {
  return from === to || PAYMENT_TRANSITIONS[from].includes(to)
}

export function checkoutUrlFromMetadata(metadata: PaymentRow['metadata']): string | null {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null
  }

  const value = 'checkoutUrl' in metadata ? metadata.checkoutUrl : null
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** What a payment is for. Anything without a known `metadata.kind` is the booking payment. */
export function paymentKind(metadata: unknown): PaymentKind {
  const kind = metadata && typeof metadata === 'object' && !Array.isArray(metadata)
    ? (metadata as { kind?: unknown }).kind
    : null
  return (SEPARATE_PAYMENT_KINDS as readonly unknown[]).includes(kind) ? kind as PaymentKind : 'booking'
}

/** Money given back to the customer after a paid booking got cheaper. */
export function isRefundPayment(payment: { status: string, metadata?: unknown }) {
  return payment.status === 'refunded' && paymentKind(payment.metadata) === 'refund'
}

export function toPublicPayment(row: PaymentRow): PublicPayment {
  return {
    uuid: row.uuid,
    kind: paymentKind(row.metadata),
    amount: Number(row.amount),
    currency: row.currency,
    provider: row.provider,
    status: row.status,
    paymentMethod: row.payment_method,
    paidAt: row.paid_at,
    checkoutUrl: checkoutUrlFromMetadata(row.metadata),
    createdAt: row.created_at,
  }
}

export function firstPayments(value: PaymentRow | PaymentRow[] | null | undefined): PublicPayment[] {
  if (!value) {
    return []
  }

  return (Array.isArray(value) ? value : [value]).map(toPublicPayment)
}
