import type { PublicRental, RentalLateFee } from '~/types/rental'
import type { RentalStatus } from './constants'

export const LATE_FEE_TYPES = ['schedule', 'product', 'half_day', 'full_day', 'custom'] as const
export type LateFeeType = (typeof LATE_FEE_TYPES)[number]

export const LATE_FEE_TYPE_LABELS: Record<LateFeeType, string> = {
  schedule: 'Waiver schedule',
  product: 'Equipment late fee per day',
  half_day: 'Half a day of rent per day late',
  full_day: '1 day of rent per day late',
  custom: 'Custom amount',
}

export const LATE_FEE_TYPE_HINTS: Record<LateFeeType, string> = {
  schedule: '₱300 under 6 hours late, half a day of rent from 6 to 12 hours, then 1 day of rent for each day late.',
  product: 'The late fee set on the equipment, for each day late.',
  half_day: 'Half of the daily rent, for each day late.',
  full_day: 'The full daily rent, for each day late.',
  custom: 'A fixed amount you enter. It applies once the booking is late.',
}

export const LATE_FEE_SHORT_FEE = 300

export const LATE_FEE_OUT_STATUSES: readonly RentalStatus[] = ['paid', 'approved', 'ready_for_pickup', 'active', 'overdue']
export const LATE_FEE_STOPPED_STATUSES: readonly RentalStatus[] = ['returned', 'completed']

export type LateFeeStatus = 'none' | 'accruing' | 'due' | 'paid' | 'void'

function money(value: number) {
  return Math.round(Math.max(0, value) * 100) / 100
}

export function lateDuration(returnAt: string, asOf: string | Date) {
  const end = Date.parse(returnAt)
  const now = typeof asOf === 'string' ? Date.parse(asOf) : asOf.getTime()
  if (Number.isNaN(end) || Number.isNaN(now) || now <= end) {
    return { hoursLate: 0, daysLate: 0 }
  }
  const hoursLate = (now - end) / 3_600_000
  return { hoursLate: Math.round(hoursLate * 100) / 100, daysLate: Math.ceil(hoursLate / 24) }
}

export function computeLateFee(input: {
  type: LateFeeType
  hoursLate: number
  dailyRent: number
  productLateFee?: number
  customAmount?: number | null
}) {
  const { hoursLate } = input
  if (hoursLate <= 0) {
    return 0
  }

  const daysLate = Math.ceil(hoursLate / 24)
  const daily = Math.max(0, input.dailyRent)
  switch (input.type) {
    case 'schedule':
      if (hoursLate < 6) {
        return LATE_FEE_SHORT_FEE
      }
      if (hoursLate <= 12) {
        return money(daily / 2)
      }
      return money(daily * daysLate)
    case 'product':
      return money(Math.max(0, input.productLateFee ?? 0) * daysLate)
    case 'half_day':
      return money((daily / 2) * daysLate)
    case 'full_day':
      return money(daily * daysLate)
    case 'custom':
      return money(input.customAmount ?? 0)
  }
}

export function lateFeeStatus(input: {
  rentalStatus: RentalStatus
  amount: number
  paid: boolean
  voided: boolean
  stopped: boolean
}): LateFeeStatus {
  if (input.paid) {
    return 'paid'
  }
  if (input.voided) {
    return 'void'
  }
  if (input.amount <= 0) {
    return 'none'
  }
  if (!input.stopped && LATE_FEE_OUT_STATUSES.includes(input.rentalStatus)) {
    return 'accruing'
  }
  return 'due'
}

export interface LateFeeRecord {
  uuid: string
  rental_id: number
  fee_type: LateFeeType
  custom_amount: number | null
  stopped_at: string | null
  paid_amount: number | null
  paid_at: string | null
  voided_at: string | null
  void_reason: string | null
}

type LateFeeRental = Pick<PublicRental, 'status' | 'returnAt' | 'items'>

function optionalNumber(value: number | null | undefined) {
  return value === null || value === undefined ? null : Number(value)
}

export function buildLateFee(
  rental: LateFeeRental,
  row: LateFeeRecord | null,
  available: boolean,
  now: Date = new Date(),
): RentalLateFee {
  const type = row?.fee_type ?? 'schedule'
  const out = LATE_FEE_OUT_STATUSES.includes(rental.status)
  const asOf = row?.paid_at ?? row?.stopped_at ?? (out ? now.toISOString() : null)
  const { hoursLate, daysLate } = asOf ? lateDuration(rental.returnAt, asOf) : { hoursLate: 0, daysLate: 0 }
  const dailyRent = rental.items.reduce((sum, item) => sum + Math.max(0, item.dailyPrice) * Math.max(0, item.quantity), 0)
  const productLateFee = rental.items.reduce((sum, item) => sum + Math.max(0, item.product.lateFee ?? 0) * Math.max(0, item.quantity), 0)
  const customAmount = optionalNumber(row?.custom_amount)
  const paidAmount = optionalNumber(row?.paid_amount)
  const amount = paidAmount ?? computeLateFee({ type, hoursLate, dailyRent, productLateFee, customAmount })

  return {
    uuid: row?.uuid ?? null,
    type,
    status: lateFeeStatus({
      rentalStatus: rental.status,
      amount,
      paid: Boolean(row?.paid_at),
      voided: Boolean(row?.voided_at),
      stopped: Boolean(row?.stopped_at),
    }),
    amount,
    hoursLate,
    daysLate,
    asOf: asOf ?? now.toISOString(),
    returnAt: rental.returnAt,
    dailyRent,
    customAmount,
    paidAt: row?.paid_at ?? null,
    voidedAt: row?.voided_at ?? null,
    voidReason: row?.void_reason ?? null,
    available,
  }
}

export function canChangeLateFee(status: LateFeeStatus) {
  return status !== 'paid'
}

export function canVoidLateFee(status: LateFeeStatus) {
  return status === 'accruing' || status === 'due'
}

export function canPayLateFee(status: LateFeeStatus) {
  return status === 'accruing' || status === 'due'
}
