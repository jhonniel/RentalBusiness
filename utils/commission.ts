import type { AdminCommission, AdminCommissionerSummary } from '~/types/commission'
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

export function isCommissionEarned(rentalStatus: string) {
  return rentalStatus === 'completed'
}

export function canCollectCommission(expenseStatus: string, rentalStatus: string | null | undefined) {
  return expenseStatus === 'pending' && isCommissionEarned(rentalStatus || '')
}

export function summarizeCommissions(items: AdminCommission[]): AdminCommissionerSummary[] {
  const totals = new Map<string, AdminCommissionerSummary>()

  for (const item of items) {
    const current = totals.get(item.commissioner.uuid) ?? {
      uuid: item.commissioner.uuid,
      firstName: item.commissioner.firstName,
      lastName: item.commissioner.lastName,
      unclaimedAmount: 0,
      collectedAmount: 0,
      unclaimedCount: 0,
    }
    if (item.status === 'unclaimed') {
      current.unclaimedAmount = Math.round((current.unclaimedAmount + item.amount) * 100) / 100
      current.unclaimedCount += 1
    }
    else {
      current.collectedAmount = Math.round((current.collectedAmount + item.amount) * 100) / 100
    }
    totals.set(item.commissioner.uuid, current)
  }

  return [...totals.values()].sort((left, right) => (
    right.unclaimedAmount - left.unclaimedAmount
    || right.collectedAmount - left.collectedAmount
    || `${left.firstName} ${left.lastName}`.localeCompare(`${right.firstName} ${right.lastName}`)
  ))
}
