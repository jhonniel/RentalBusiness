import { describe, expect, it } from 'vitest'
import { cronSecretMatches } from '../../server/utils/cron-secret'
import {
  extractCronSecret,
  isOverdueRental,
  isPickupReminderDue,
  isRecurringExpenseDue,
  isReturnReminderDue,
  isSupabaseKeepAliveDue,
  isUnconfirmedRequestExpired,
  reminderOn,
} from '../../utils/cron'
import { canTransitionRentalStatus } from '../../utils/rental-status'

describe('cron secrets', () => {
  it('reads Bearer and x-cron-secret values and rejects mismatches', () => {
    expect(extractCronSecret('Bearer cron-secret', null)).toBe('cron-secret')
    expect(extractCronSecret(null, 'header-secret')).toBe('header-secret')
    expect(extractCronSecret('Basic nope', null)).toBe('')
    expect(cronSecretMatches('cron-secret', 'cron-secret')).toBe(true)
    expect(cronSecretMatches('cron-secret', 'other-secret')).toBe(false)
    expect(cronSecretMatches('', '')).toBe(false)
    expect(extractCronSecret(null, null)).toBe('')
  })
})

describe('cron due dates', () => {
  it('posts only active recurring expenses that are due on or before today', () => {
    expect(isRecurringExpenseDue('2026-09-13', '2026-09-13', null, 'active')).toBe(true)
    expect(isRecurringExpenseDue('2026-09-12', '2026-09-13', null, 'active')).toBe(true)
    expect(isRecurringExpenseDue('2026-09-14', '2026-09-13', null, 'active')).toBe(false)
    expect(isRecurringExpenseDue('2026-09-13', '2026-09-13', '2026-09-12', 'active')).toBe(false)
    expect(isRecurringExpenseDue('2026-09-13', '2026-09-13', null, 'paused')).toBe(false)
  })

  it('reminds one Manila calendar day ahead and marks active rentals overdue after the end date', () => {
    expect(reminderOn('2026-09-13')).toBe('2026-09-14')
    expect(isPickupReminderDue('approved', '2026-09-14', '2026-09-14')).toBe(true)
    expect(isPickupReminderDue('pending', '2026-09-14', '2026-09-14')).toBe(false)
    expect(isReturnReminderDue('active', '2026-09-14', '2026-09-14')).toBe(true)
    expect(isReturnReminderDue('draft', '2026-09-14', '2026-09-14')).toBe(false)
    expect(isOverdueRental('active', '2026-09-12', '2026-09-13')).toBe(true)
    expect(isOverdueRental('active', '2026-09-13', '2026-09-13')).toBe(false)
    expect(isOverdueRental('returned', '2026-09-12', '2026-09-13')).toBe(false)
    expect(canTransitionRentalStatus('active', 'overdue')).toBe(true)
    expect(canTransitionRentalStatus('overdue', 'overdue')).toBe(false)
  })

  it('pings Supabase every 3 days to keep the project awake', () => {
    expect(isSupabaseKeepAliveDue('2026-09-22')).toBe(true)
    expect(isSupabaseKeepAliveDue('2026-09-22', '2026-09-22')).toBe(false)
    expect(isSupabaseKeepAliveDue('2026-09-24', '2026-09-22')).toBe(false)
    expect(isSupabaseKeepAliveDue('2026-09-25', '2026-09-22')).toBe(true)
    expect(isSupabaseKeepAliveDue('2026-09-26', '2026-09-22')).toBe(true)
  })

  it('cancels a pending request after 24 hours without confirmation', () => {
    const now = new Date('2026-09-22T16:00:00.000Z')
    expect(isUnconfirmedRequestExpired('pending', '2026-09-21T15:59:59.000Z', now)).toBe(true)
    expect(isUnconfirmedRequestExpired('pending', '2026-09-21T16:00:01.000Z', now)).toBe(false)
    expect(isUnconfirmedRequestExpired('awaiting_payment', '2026-09-20T00:00:00.000Z', now)).toBe(false)
    expect(canTransitionRentalStatus('pending', 'cancelled')).toBe(true)
  })
})
