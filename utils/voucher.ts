import type { VoucherDiscountType, VoucherStatus } from './constants'
import { calendarDateInZone } from './datetime'
import { fromMinorUnits, toMinorUnits } from './currency'

const VOUCHER_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export interface VoucherRow {
  uuid: string
  code: string
  name: string
  discount_type: VoucherDiscountType
  discount_value: number
  max_redemptions: number | null
  redeemed_count: number
  min_subtotal: number
  starts_on: string | null
  ends_on: string | null
  status: VoucherStatus
  created_at: string
}

export interface VoucherRedemptionRow {
  uuid: string
  code: string
  name: string
  discount_amount: number
}

export function normalizeVoucherCode(value: string) {
  return value.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '')
}

export function generateVoucherCode() {
  let body = ''
  for (let index = 0; index < 6; index += 1) {
    body += VOUCHER_ALPHABET[Math.floor(Math.random() * VOUCHER_ALPHABET.length)]
  }
  return `JRY-${body}`
}

export function quoteVoucherDiscount(input: {
  type: VoucherDiscountType
  value: number
  subtotal: number
}) {
  const subtotal = Math.max(0, input.subtotal)
  if (input.type === 'percent') {
    return fromMinorUnits(toMinorUnits(subtotal * (input.value / 100)))
  }

  return fromMinorUnits(toMinorUnits(Math.min(input.value, subtotal)))
}

export function voucherDisplayStatus(row: Pick<VoucherRow, 'status' | 'starts_on' | 'ends_on'>, today = calendarDateInZone()) {
  if (row.status !== 'active') {
    return row.status
  }

  if (row.ends_on && row.ends_on < today) {
    return 'expired'
  }

  if (row.starts_on && row.starts_on > today) {
    return 'scheduled'
  }

  return 'active'
}

export function voucherIsRedeemable(row: VoucherRow, subtotal: number, today = calendarDateInZone()) {
  if (row.status !== 'active') {
    return 'That voucher is not active.'
  }

  if (row.starts_on && row.starts_on > today) {
    return 'That voucher is not valid yet.'
  }

  if (row.ends_on && row.ends_on < today) {
    return 'That voucher has expired.'
  }

  if (row.max_redemptions !== null && row.redeemed_count >= row.max_redemptions) {
    return 'That voucher has already been used up.'
  }

  if (subtotal < Number(row.min_subtotal)) {
    return 'This booking does not meet the minimum amount for that voucher.'
  }

  return null
}

export function toPublicVoucher(row: VoucherRow) {
  return {
    uuid: row.uuid,
    code: row.code,
    name: row.name,
    discountType: row.discount_type,
    discountValue: Number(row.discount_value),
    maxRedemptions: row.max_redemptions,
    redeemedCount: row.redeemed_count,
    minSubtotal: Number(row.min_subtotal),
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    status: row.status,
    displayStatus: voucherDisplayStatus(row),
    createdAt: row.created_at,
  }
}

export function toPublicRentalVoucher(row: VoucherRedemptionRow | VoucherRedemptionRow[] | null | undefined) {
  const redemption = Array.isArray(row) ? row[0] : row
  if (!redemption) {
    return null
  }

  return {
    uuid: redemption.uuid,
    code: redemption.code,
    name: redemption.name,
    discountAmount: Number(redemption.discount_amount),
  }
}
