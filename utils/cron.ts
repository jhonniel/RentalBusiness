import type { RecurringExpenseStatus, RentalStatus } from './constants'
import { addCalendarDays } from './expense'

export const CRON_CATCH_UP_LIMIT = 24
export const UNCONFIRMED_REQUEST_HOURS = 24
export const UNCONFIRMED_REQUEST_MS = UNCONFIRMED_REQUEST_HOURS * 60 * 60 * 1000
export const SUPABASE_KEEP_ALIVE_DAYS = 3
export const SUPABASE_KEEP_ALIVE_SETTING = 'supabase_keep_alive'

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

export function isSupabaseKeepAliveDue(today: string, lastPingedOn?: string | null): boolean {
  if (!lastPingedOn) {
    return true
  }

  return addCalendarDays(lastPingedOn, SUPABASE_KEEP_ALIVE_DAYS) <= today
}

export function isUnconfirmedRequestExpired(
  status: RentalStatus,
  submittedAt: string,
  now = new Date(),
): boolean {
  if (status !== 'pending') {
    return false
  }

  const submitted = new Date(submittedAt).getTime()
  if (Number.isNaN(submitted)) {
    return false
  }

  return now.getTime() - submitted >= UNCONFIRMED_REQUEST_MS
}
