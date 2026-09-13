import type { PublicExpense, PublicExpenseOccurrence, PublicRecurringExpense } from '~/types/expense'
import type { ExpenseFrequency, ExpenseStatus, RecurringExpenseStatus } from './constants'

export interface ExpenseRow {
  uuid: string
  name: string
  category: PublicExpense['category']
  description: string | null
  amount: number
  vendor: string | null
  reference: string | null
  status: ExpenseStatus
  notes: string | null
  incurred_on: string
  created_at: string
  updated_at: string
}

export interface RecurringExpenseRow {
  uuid: string
  name: string
  category: PublicRecurringExpense['category']
  amount: number
  frequency: ExpenseFrequency
  interval_count: number
  anchor_day: number | null
  start_on: string
  end_on: string | null
  next_occurrence_on: string
  vendor: string | null
  status: RecurringExpenseStatus
  notes: string | null
  created_at: string
  updated_at: string
  expense_occurrences?: { count: number }[] | { count: number } | null
}

export interface OccurrenceRow {
  uuid: string
  occurs_on: string
  generated_at: string
  expenses?: {
    uuid: string
    name: string
    amount: number
    status: ExpenseStatus
    incurred_on: string
  } | {
    uuid: string
    name: string
    amount: number
    status: ExpenseStatus
    incurred_on: string
  }[] | null
}

function first<T>(value: T | T[] | null | undefined): T | null {
  if (!value) {
    return null
  }
  return Array.isArray(value) ? value[0] ?? null : value
}

function occurrenceCount(value: RecurringExpenseRow['expense_occurrences']) {
  const row = first(value)
  return row && 'count' in row ? Number(row.count) || 0 : 0
}

export function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10)
}

export function addCalendarMonths(date: string, months: number, anchorDay?: number | null): string {
  const [year, month, day] = date.split('-').map(Number)
  const monthIndex = month - 1 + months
  const targetYear = year + Math.floor(monthIndex / 12)
  const targetMonth = ((monthIndex % 12) + 12) % 12
  const desiredDay = anchorDay && anchorDay > 0 ? anchorDay : day
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate()
  return new Date(Date.UTC(targetYear, targetMonth, Math.min(desiredDay, lastDay))).toISOString().slice(0, 10)
}

export function nextOccurrenceOn(input: {
  frequency: ExpenseFrequency
  intervalCount: number
  fromOn: string
  anchorDay?: number | null
}): string {
  const interval = Math.max(1, input.intervalCount)

  switch (input.frequency) {
    case 'daily':
      return addCalendarDays(input.fromOn, interval)
    case 'weekly':
      return addCalendarDays(input.fromOn, interval * 7)
    case 'monthly':
      return addCalendarMonths(input.fromOn, interval, input.anchorDay)
    case 'quarterly':
      return addCalendarMonths(input.fromOn, interval * 3, input.anchorDay)
    case 'yearly':
      return addCalendarMonths(input.fromOn, interval * 12, input.anchorDay)
    case 'custom':
      return addCalendarDays(input.fromOn, interval)
  }
}

export function canEditExpense(status: ExpenseStatus) {
  return status !== 'void'
}

export function canPostRecurringExpense(status: RecurringExpenseStatus) {
  return status === 'active'
}

export function toPublicExpense(row: ExpenseRow): PublicExpense {
  return {
    uuid: row.uuid,
    name: row.name,
    category: row.category,
    description: row.description,
    amount: Number(row.amount),
    vendor: row.vendor,
    reference: row.reference,
    status: row.status,
    notes: row.notes,
    incurredOn: row.incurred_on,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function toPublicOccurrence(row: OccurrenceRow): PublicExpenseOccurrence {
  const expense = first(row.expenses)

  return {
    uuid: row.uuid,
    occursOn: row.occurs_on,
    generatedAt: row.generated_at,
    expense: expense
      ? {
          uuid: expense.uuid,
          name: expense.name,
          amount: Number(expense.amount),
          status: expense.status,
          incurredOn: expense.incurred_on,
        }
      : null,
  }
}

export function toPublicRecurringExpense(
  row: RecurringExpenseRow,
  occurrences?: OccurrenceRow[],
): PublicRecurringExpense {
  return {
    uuid: row.uuid,
    name: row.name,
    category: row.category,
    amount: Number(row.amount),
    frequency: row.frequency,
    intervalCount: row.interval_count,
    anchorDay: row.anchor_day,
    startOn: row.start_on,
    endOn: row.end_on,
    nextOccurrenceOn: row.next_occurrence_on,
    vendor: row.vendor,
    status: row.status,
    notes: row.notes,
    occurrenceCount: occurrenceCount(row.expense_occurrences),
    occurrences: occurrences?.map(toPublicOccurrence),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}
