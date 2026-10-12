import { rentalPeriodDays } from './rental-window'

export const COMMISSIONER_RELEASE_STATUSES = ['draft', 'pending', 'awaiting_payment'] as const

export function commissionAmount(perDay: number, startsOn: string, endsOn: string, quantity: number) {
  const days = rentalPeriodDays(startsOn, endsOn)
  const units = Math.max(0, quantity)
  const rate = Number.isFinite(perDay) ? Math.max(0, perDay) : 0
  return Math.round(rate * days * units * 100) / 100
}

export function canReleaseCommissionerBooking(status: string) {
  return (COMMISSIONER_RELEASE_STATUSES as readonly string[]).includes(status)
}
