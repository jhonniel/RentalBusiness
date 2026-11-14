import { describe, expect, it } from 'vitest'
import {
  addCalendarDays,
  addCalendarMonths,
  canEditExpense,
  canPostRecurringExpense,
  nextOccurrenceOn,
  toPublicExpense,
  toPublicRecurringExpense,
  monthlyEquivalent,
  recurrenceLabel,
} from '../../utils/expense'
import { expenseInputSchema, recurringExpenseInputSchema } from '../../utils/expense-validation'

describe('expense occurrence dates', () => {
  it('advances calendar days without shifting the business date', () => {
    expect(addCalendarDays('2026-09-13', 1)).toBe('2026-09-14')
    expect(addCalendarMonths('2026-01-31', 1, 31)).toBe('2026-02-28')
    expect(addCalendarMonths('2024-01-31', 1, 31)).toBe('2024-02-29')
    expect(nextOccurrenceOn({
      frequency: 'monthly',
      intervalCount: 1,
      fromOn: '2026-01-15',
      anchorDay: 15,
    })).toBe('2026-02-15')
    expect(nextOccurrenceOn({
      frequency: 'quarterly',
      intervalCount: 1,
      fromOn: '2026-01-15',
      anchorDay: 15,
    })).toBe('2026-04-15')
    expect(nextOccurrenceOn({
      frequency: 'yearly',
      intervalCount: 1,
      fromOn: '2024-02-29',
    })).toBe('2025-02-28')
    expect(nextOccurrenceOn({
      frequency: 'custom',
      intervalCount: 10,
      fromOn: '2026-09-13',
    })).toBe('2026-09-23')
    expect(nextOccurrenceOn({
      frequency: 'weekly',
      intervalCount: 2,
      fromOn: '2026-09-13',
    })).toBe('2026-09-27')
  })
})

describe('expense rules', () => {
  it('locks void expenses and only posts active templates', () => {
    expect(canEditExpense('paid')).toBe(true)
    expect(canEditExpense('void')).toBe(false)
    expect(canPostRecurringExpense('active')).toBe(true)
    expect(canPostRecurringExpense('paused')).toBe(false)
    expect(canPostRecurringExpense('ended')).toBe(false)
  })

  it('rejects privileged ids and inverted recurring dates', () => {
    expect(expenseInputSchema.safeParse({
      name: 'Cleaning',
      category: 'maintenance',
      amount: 1800,
      incurredOn: '2026-09-01',
      id: 9,
    }).success).toBe(false)

    expect(recurringExpenseInputSchema.safeParse({
      name: 'Starlink',
      category: 'subscription',
      amount: 2500,
      frequency: 'monthly',
      startOn: '2026-10-15',
      endOn: '2026-01-15',
    }).success).toBe(false)

    expect(recurringExpenseInputSchema.parse({
      name: 'Starlink',
      category: 'subscription',
      amount: 2500,
      frequency: 'monthly',
      startOn: '2026-01-15',
      nextOccurrenceOn: '2026-10-15',
    })).toMatchObject({
      intervalCount: 1,
    })
  })
})

describe('expense mapper', () => {
  it('never includes internal ids', () => {
    const expense = toPublicExpense({
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Camera sensor cleaning',
      category: 'maintenance',
      description: null,
      amount: 1800,
      vendor: 'Metro Camera Care',
      reference: 'MCC-2026-091',
      status: 'paid',
      notes: null,
      incurred_on: '2026-09-01',
      created_at: '2026-09-13T00:00:00.000Z',
      updated_at: '2026-09-13T00:00:00.000Z',
    })

    const recurring = toPublicRecurringExpense({
      uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      name: 'Starlink subscription',
      category: 'subscription',
      amount: 2500,
      frequency: 'monthly',
      interval_count: 1,
      anchor_day: 15,
      start_on: '2026-01-15',
      end_on: null,
      next_occurrence_on: '2026-10-15',
      vendor: 'Starlink',
      status: 'active',
      notes: null,
      created_at: '2026-09-13T00:00:00.000Z',
      updated_at: '2026-09-13T00:00:00.000Z',
      expense_occurrences: [{ count: 0 }],
    })

    expect(expense).not.toHaveProperty('id')
    expect(recurring).not.toHaveProperty('id')
    expect(recurring.occurrenceCount).toBe(0)
  })
})

describe('recurring expenses on the Expenses page', () => {
  it('labels the schedule in plain words', () => {
    expect(recurrenceLabel('monthly', 1)).toBe('Every month')
    expect(recurrenceLabel('weekly', 2)).toBe('Every 2 weeks')
    expect(recurrenceLabel('custom', 10)).toBe('Every 10 days')
  })

  it('estimates what each recurring bill costs per month', () => {
    expect(monthlyEquivalent(5999, 'monthly', 1)).toBe(5999)
    expect(monthlyEquivalent(1200, 'yearly', 1)).toBe(100)
    expect(monthlyEquivalent(900, 'quarterly', 1)).toBe(300)
    expect(monthlyEquivalent(100, 'weekly', 1)).toBeCloseTo(434.82, 1)
  })
})
