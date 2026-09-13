import { timingSafeEqual } from 'node:crypto'
import type { RecurringExpenseStatus, RentalStatus } from './constants'
import { addCalendarDays } from './expense'

export const CRON_CATCH_UP_LIMIT = 24

export function extractCronSecret(
  authorization?: string | null,
  cronHeader?: string | null,
): string {
  if (cronHeader?.trim()) {
    return cronHeader.trim()
  }

  if (authorization?.toLowerCase().startsWith('bearer ')) {
    return authorization.slice(7).trim()
  }

  return ''
}

export function cronSecretMatches(expected: string, provided: string): boolean {
  if (!expected || !provided) {
    return false
  }

  const left = Buffer.from(expected)
  const right = Buffer.from(provided)
  if (left.length !== right.length) {
    return false
  }

  return timingSafeEqual(left, right)
}

export function reminderOn(today: string, daysAhead = 1): string {
  return addCalendarDays(today, daysAhead)
}

export function isRecurringExpenseDue(
  nextOccurrenceOn: string,
  today: string,
  endOn: string | null,
  status: RecurringExpenseStatus,
): boolean {
  if (status !== 'active') {
    return false
  }
  if (endOn && nextOccurrenceOn > endOn) {
    return false
  }
  return nextOccurrenceOn <= today
}

export function isPickupReminderDue(status: RentalStatus, startsOn: string, remindOn: string): boolean {
  return ['paid', 'approved', 'ready_for_pickup'].includes(status) && startsOn === remindOn
}

export function isReturnReminderDue(status: RentalStatus, endsOn: string, remindOn: string): boolean {
  return ['active', 'overdue'].includes(status) && endsOn === remindOn
}

export function isOverdueRental(status: RentalStatus, endsOn: string, today: string): boolean {
  return status === 'active' && endsOn < today
}
