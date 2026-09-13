import { createHmac, timingSafeEqual } from 'node:crypto'
import type { PublicPayment } from '~/types/payment'
import type { Json } from '~/types/database.types'
import type { PaymentStatus } from './constants'

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

export function toPublicPayment(row: PaymentRow): PublicPayment {
  return {
    uuid: row.uuid,
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

export function signPaymentPayload(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex')
}

export function verifyPaymentSignature(secret: string, body: string, header: string | undefined): boolean {
  if (!header) {
    return false
  }

  const provided = header.startsWith('sha256=') ? header.slice(7) : header
  const expected = signPaymentPayload(secret, body)

  try {
    const left = Buffer.from(expected, 'hex')
    const right = Buffer.from(provided, 'hex')
    return left.length === right.length && timingSafeEqual(left, right)
  }
  catch {
    return false
  }
}
