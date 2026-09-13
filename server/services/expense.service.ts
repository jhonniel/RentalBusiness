import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../../types/database.types'
import type { ExpenseInput, RecurringExpenseInput } from '../../utils/expense-validation'
import type { ExpenseCategory, ExpenseStatus, RecurringExpenseStatus } from '../../utils/constants'
import {
  canEditExpense,
  canPostRecurringExpense,
  nextOccurrenceOn,
  toPublicExpense,
  toPublicOccurrence,
  toPublicRecurringExpense,
} from '../../utils/expense'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import {
  findExpenseByUuid,
  findExpenseIdentity,
  findOccurrenceByDate,
  findRecurringExpenseByUuid,
  findRecurringExpenseIdentity,
  insertExpense,
  insertOccurrence,
  insertRecurringExpense,
  listExpenses,
  listOccurrences,
  listRecurringExpenses,
  updateExpenseByUuid,
  updateRecurringExpenseByUuid,
} from '../repositories/expense.repository'

type Client = SupabaseClient<Database>

function sanitizeSearch(value?: string) {
  return value?.replace(/[%_,]/g, '').trim() || undefined
}

function emptyToNull(value?: string | null) {
  return value?.trim() ? value.trim() : null
}

async function loadExpense(client: Client, uuid: string) {
  const row = await findExpenseByUuid(client, uuid)
  if (!row) {
    throw new AppError('Expense not found.', 404, ERROR_CODES.NOT_FOUND)
  }
  return row
}

async function loadRecurring(client: Client, uuid: string) {
  const row = await findRecurringExpenseByUuid(client, uuid)
  if (!row) {
    throw new AppError('Recurring expense not found.', 404, ERROR_CODES.NOT_FOUND)
  }
  return row
}

export async function listAdminExpenses(client: Client, query: {
  search?: string
  category?: ExpenseCategory
  status?: ExpenseStatus
  page: number
  pageSize: number
}) {
  const from = (query.page - 1) * query.pageSize
  const { rows, total } = await listExpenses(client, {
    search: sanitizeSearch(query.search),
    category: query.category,
    status: query.status,
    from,
    to: from + query.pageSize - 1,
  })

  return {
    items: rows.map(toPublicExpense),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function getAdminExpense(client: Client, uuid: string) {
  return toPublicExpense(await loadExpense(client, uuid))
}

export async function createAdminExpense(event: H3Event, client: Client, input: ExpenseInput) {
  const row = await insertExpense(client, {
    name: input.name,
    category: input.category,
    description: emptyToNull(input.description),
    amount: input.amount,
    vendor: emptyToNull(input.vendor),
    reference: emptyToNull(input.reference),
    status: input.status,
    notes: emptyToNull(input.notes),
    incurred_on: input.incurredOn,
  })

  const next = toPublicExpense(row)
  await recordAudit(event, client, {
    action: 'expense.create',
    entity: 'expenses',
    entityId: next.uuid,
    next: next as unknown as Json,
  })
  return next
}

export async function updateAdminExpense(event: H3Event, client: Client, uuid: string, input: ExpenseInput) {
  const current = await loadExpense(client, uuid)
  if (!canEditExpense(current.status)) {
    throw new AppError('Void expenses cannot be changed.', 409, ERROR_CODES.CONFLICT)
  }

  const row = await updateExpenseByUuid(client, uuid, {
    name: input.name,
    category: input.category,
    description: emptyToNull(input.description),
    amount: input.amount,
    vendor: emptyToNull(input.vendor),
    reference: emptyToNull(input.reference),
    status: input.status,
    notes: emptyToNull(input.notes),
    incurred_on: input.incurredOn,
  })

  const next = toPublicExpense(row)
  await recordAudit(event, client, {
    action: 'expense.update',
    entity: 'expenses',
    entityId: next.uuid,
    previous: toPublicExpense(current) as unknown as Json,
    next: next as unknown as Json,
  })
  return next
}

export async function voidAdminExpense(event: H3Event, client: Client, uuid: string) {
  const current = await loadExpense(client, uuid)
  if (current.status === 'void') {
    throw new AppError('That expense is already void.', 409, ERROR_CODES.CONFLICT)
  }

  const row = await updateExpenseByUuid(client, uuid, { status: 'void' })
  const next = toPublicExpense(row)
  await recordAudit(event, client, {
    action: 'expense.void',
    entity: 'expenses',
    entityId: next.uuid,
    previous: { status: current.status },
    next: { status: 'void' },
  })
  return next
}

export async function listAdminRecurringExpenses(client: Client, query: {
  search?: string
  category?: ExpenseCategory
  status?: RecurringExpenseStatus
  page: number
  pageSize: number
}) {
  const from = (query.page - 1) * query.pageSize
  const { rows, total } = await listRecurringExpenses(client, {
    search: sanitizeSearch(query.search),
    category: query.category,
    status: query.status,
    from,
    to: from + query.pageSize - 1,
  })

  return {
    items: rows.map(row => toPublicRecurringExpense(row)),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function getAdminRecurringExpense(client: Client, uuid: string) {
  const row = await loadRecurring(client, uuid)
  const identity = await findRecurringExpenseIdentity(client, uuid)
  const occurrences = identity
    ? await listOccurrences(client, identity.id, 0, 19)
    : { rows: [] }

  return toPublicRecurringExpense(row, occurrences.rows)
}

export async function createAdminRecurringExpense(event: H3Event, client: Client, input: RecurringExpenseInput) {
  const nextOccurrenceOn = input.nextOccurrenceOn || input.startOn
  const row = await insertRecurringExpense(client, {
    name: input.name,
    category: input.category,
    amount: input.amount,
    frequency: input.frequency,
    interval_count: input.intervalCount,
    anchor_day: input.anchorDay ?? null,
    start_on: input.startOn,
    end_on: input.endOn || null,
    next_occurrence_on: nextOccurrenceOn,
    vendor: emptyToNull(input.vendor),
    status: 'active',
    notes: emptyToNull(input.notes),
  })

  const next = toPublicRecurringExpense(row)
  await recordAudit(event, client, {
    action: 'recurring_expense.create',
    entity: 'recurring_expenses',
    entityId: next.uuid,
    next: next as unknown as Json,
  })
  return next
}

export async function updateAdminRecurringExpense(
  event: H3Event,
  client: Client,
  uuid: string,
  input: RecurringExpenseInput,
) {
  const current = await loadRecurring(client, uuid)
  if (current.status === 'ended') {
    throw new AppError('Ended recurring expenses cannot be changed.', 409, ERROR_CODES.CONFLICT)
  }

  const row = await updateRecurringExpenseByUuid(client, uuid, {
    name: input.name,
    category: input.category,
    amount: input.amount,
    frequency: input.frequency,
    interval_count: input.intervalCount,
    anchor_day: input.anchorDay ?? null,
    start_on: input.startOn,
    end_on: input.endOn || null,
    next_occurrence_on: input.nextOccurrenceOn || current.next_occurrence_on,
    vendor: emptyToNull(input.vendor),
    notes: emptyToNull(input.notes),
  })

  const next = toPublicRecurringExpense(row)
  await recordAudit(event, client, {
    action: 'recurring_expense.update',
    entity: 'recurring_expenses',
    entityId: next.uuid,
    previous: toPublicRecurringExpense(current) as unknown as Json,
    next: next as unknown as Json,
  })
  return next
}

async function setRecurringStatus(
  event: H3Event,
  client: Client,
  uuid: string,
  status: RecurringExpenseStatus,
  action: string,
) {
  const current = await loadRecurring(client, uuid)
  if (current.status === status) {
    return toPublicRecurringExpense(current)
  }

  if (current.status === 'ended' && status !== 'ended') {
    throw new AppError('Ended recurring expenses cannot be reopened.', 409, ERROR_CODES.CONFLICT)
  }

  const row = await updateRecurringExpenseByUuid(client, uuid, { status })
  const next = toPublicRecurringExpense(row)
  await recordAudit(event, client, {
    action,
    entity: 'recurring_expenses',
    entityId: next.uuid,
    previous: { status: current.status },
    next: { status },
  })
  return next
}

export async function pauseAdminRecurringExpense(event: H3Event, client: Client, uuid: string) {
  return setRecurringStatus(event, client, uuid, 'paused', 'recurring_expense.pause')
}

export async function resumeAdminRecurringExpense(event: H3Event, client: Client, uuid: string) {
  return setRecurringStatus(event, client, uuid, 'active', 'recurring_expense.resume')
}

export async function endAdminRecurringExpense(event: H3Event, client: Client, uuid: string) {
  return setRecurringStatus(event, client, uuid, 'ended', 'recurring_expense.end')
}

export async function listAdminOccurrences(client: Client, uuid: string, query: {
  page: number
  pageSize: number
}) {
  const identity = await findRecurringExpenseIdentity(client, uuid)
  if (!identity) {
    throw new AppError('Recurring expense not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const from = (query.page - 1) * query.pageSize
  const { rows, total } = await listOccurrences(client, identity.id, from, from + query.pageSize - 1)
  return {
    items: rows.map(toPublicOccurrence),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function postAdminOccurrence(event: H3Event, client: Client, uuid: string) {
  const template = await findRecurringExpenseIdentity(client, uuid)
  if (!template) {
    throw new AppError('Recurring expense not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  if (!canPostRecurringExpense(template.status)) {
    throw new AppError('Only active recurring expenses can be posted.', 409, ERROR_CODES.CONFLICT)
  }

  const occursOn = template.next_occurrence_on
  if (template.end_on && occursOn > template.end_on) {
    await updateRecurringExpenseByUuid(client, uuid, { status: 'ended' })
    throw new AppError('That recurring expense has already ended.', 409, ERROR_CODES.CONFLICT)
  }

  const existing = await findOccurrenceByDate(client, template.id, occursOn)
  if (existing) {
    const nextDate = nextOccurrenceOn({
      frequency: template.frequency,
      intervalCount: template.interval_count,
      fromOn: occursOn,
      anchorDay: template.anchor_day,
    })
    await updateRecurringExpenseByUuid(client, uuid, {
      next_occurrence_on: nextDate,
      status: template.end_on && nextDate > template.end_on ? 'ended' : template.status,
    })
    return toPublicOccurrence(existing)
  }

  const expense = await insertExpense(client, {
    name: template.name,
    category: template.category,
    amount: template.amount,
    vendor: template.vendor,
    status: 'pending',
    incurred_on: occursOn,
    notes: template.notes,
    reference: `REC-${occursOn}`,
  })

  const identity = await findExpenseIdentity(client, expense.uuid)
  if (!identity) {
    throw new AppError('We could not link that occurrence.', 500, ERROR_CODES.INTERNAL_ERROR)
  }

  const occurrence = await insertOccurrence(client, {
    recurring_expense_id: template.id,
    expense_id: identity.id,
    occurs_on: occursOn,
  })

  const nextDate = nextOccurrenceOn({
    frequency: template.frequency,
    intervalCount: template.interval_count,
    fromOn: occursOn,
    anchorDay: template.anchor_day,
  })

  await updateRecurringExpenseByUuid(client, uuid, {
    next_occurrence_on: nextDate,
    status: template.end_on && nextDate > template.end_on ? 'ended' : template.status,
  })

  await recordAudit(event, client, {
    action: 'recurring_expense.post',
    entity: 'expense_occurrences',
    entityId: occurrence.uuid,
    next: {
      recurringExpenseUuid: uuid,
      expenseUuid: expense.uuid,
      occursOn,
    },
  })

  return toPublicOccurrence(occurrence)
}
