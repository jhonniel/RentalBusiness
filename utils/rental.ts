import type { PublicRental, PublicRentalItem } from '~/types/rental'
import type { RentalStatus } from './constants'
import { toPublicRentalIdentity, type IdentityVerificationRow } from './identity'
import { firstPayments, type PaymentRow } from './payment'
import { firstReceipts, type ReceiptRow } from './receipt'
import { toPublicRentalVoucher, type VoucherRedemptionRow } from './voucher'
import { firstWaiverAcceptance, type WaiverAcceptanceRow } from './waiver'

interface ProductRef {
  uuid: string
  slug: string
  name: string
  sku: string
  deposit_amount?: number | null
  late_fee?: number | null
  replacement_value?: number | null
}

interface ItemRow {
  uuid: string
  quantity: number
  daily_price: number
  line_total: number
  products: ProductRef | ProductRef[] | null
}

interface RentalRow {
  uuid: string
  code: string
  status: RentalStatus
  starts_on: string
  ends_on: string
  subtotal: number
  deposit_amount: number
  discount_amount: number
  tax_amount: number
  total_amount: number
  notes: string | null
  created_at: string
  rental_items: ItemRow[] | null
  rental_identity_verifications?: IdentityVerificationRow | IdentityVerificationRow[] | null
  waiver_acceptances?: WaiverAcceptanceRow | WaiverAcceptanceRow[] | null
  payment_transactions?: PaymentRow | PaymentRow[] | null
  receipts?: ReceiptRow | ReceiptRow[] | null
  voucher_redemptions?: VoucherRedemptionRow | VoucherRedemptionRow[] | null
  profiles?: {
    uuid: string
    first_name: string
    last_name: string
    phone: string | null
  } | {
    uuid: string
    first_name: string
    last_name: string
    phone: string | null
  }[] | null
}

function toPublicCustomer(value: RentalRow['profiles']) {
  const row = Array.isArray(value) ? value[0] : value
  if (!row) {
    return null
  }

  return {
    uuid: row.uuid,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
  }
}

function asProduct(value: ItemRow['products']): ProductRef {
  const row = Array.isArray(value) ? value[0] : value
  if (!row) {
    throw new Error('Rental item is missing a product.')
  }
  return row
}

export function toPublicRentalItem(row: ItemRow): PublicRentalItem {
  const product = asProduct(row.products)
  return {
    uuid: row.uuid,
    quantity: row.quantity,
    dailyPrice: Number(row.daily_price),
    lineTotal: Number(row.line_total),
    product: {
      uuid: product.uuid,
      slug: product.slug,
      name: product.name,
      sku: product.sku,
      depositAmount: Number(product.deposit_amount ?? 0),
      lateFee: Number(product.late_fee ?? 0),
      replacementValue: product.replacement_value === null || product.replacement_value === undefined
        ? null
        : Number(product.replacement_value),
    },
  }
}

export function toPublicRental(row: RentalRow): PublicRental {
  return {
    uuid: row.uuid,
    code: row.code,
    status: row.status,
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    subtotal: Number(row.subtotal),
    depositAmount: Number(row.deposit_amount),
    discountAmount: Number(row.discount_amount),
    taxAmount: Number(row.tax_amount),
    totalAmount: Number(row.total_amount),
    notes: row.notes,
    voucher: toPublicRentalVoucher(row.voucher_redemptions),
    items: (row.rental_items ?? []).map(toPublicRentalItem),
    waiver: firstWaiverAcceptance(row.waiver_acceptances),
    identity: toPublicRentalIdentity(row.rental_identity_verifications),
    payments: firstPayments(row.payment_transactions),
    receipts: firstReceipts(row.receipts),
    customer: toPublicCustomer(row.profiles),
    createdAt: row.created_at,
  }
}

export function isRentalCode(value: string): boolean {
  return /^LUM-\d{8}-\d+$/.test(value)
}

export function canSubmitRentalRequest(rental: Pick<PublicRental, 'status' | 'waiver' | 'identity'>) {
  return rental.status === 'draft' && Boolean(rental.waiver) && Boolean(rental.identity)
}

export function customerRentalNextLabel(rental: Pick<PublicRental, 'status' | 'waiver' | 'identity'>) {
  if (rental.status === 'draft' && !rental.waiver) {
    return 'Sign the waiver'
  }
  if (rental.status === 'draft' && !rental.identity) {
    return 'Upload ID'
  }
  if (canSubmitRentalRequest(rental)) {
    return 'Submit request'
  }
  if (rental.status === 'pending') {
    return 'Waiting for confirmation'
  }
  if (rental.status === 'awaiting_payment') {
    return 'Pay now'
  }
  return null
}

export function customerRentalNextPath(rental: Pick<PublicRental, 'code' | 'status' | 'waiver' | 'identity'>) {
  if (rental.status === 'draft' && !rental.waiver) {
    return `/rentals/${rental.code}/waiver`
  }
  if (rental.status === 'draft' && !rental.identity) {
    return `/rentals/${rental.code}/verify`
  }
  if (canSubmitRentalRequest(rental) || rental.status === 'pending') {
    return `/rentals/${rental.code}`
  }
  if (rental.status === 'awaiting_payment') {
    return `/rentals/${rental.code}/pay`
  }
  return `/rentals/${rental.code}`
}
