import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { ExpenseCategory, ExpenseStatus, RecurringExpenseStatus } from '../../utils/constants'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

const EXPENSE_SELECT = `
  uuid,
  name,
  category,
  description,
  amount,
  vendor,
  reference,
  status,
  notes,
  incurred_on,
  created_at,
  updated_at
`

const RECURRING_SELECT = `
  uuid,
  name,
  category,
  amount,
  frequency,
  interval_count,
  anchor_day,
  start_on,
  end_on,
  next_occurrence_on,
  vendor,
  status,
  notes,
  created_at,
  updated_at,
  expense_occurrences(count)
`

const OCCURRENCE_SELECT = `
  uuid,
  occurs_on,
  generated_at,
  expenses (
    uuid,
    name,
    amount,
    status,
    incurred_on
  )
`

export async function listExpenses(client: Client, filters: {
  search?: string
  category?: ExpenseCategory
  status?: ExpenseStatus
  from: number
  to: number
}) {
  let query = client
    .from('expenses')
    .select(EXPENSE_SELECT, { count: 'exact' })
    .order('incurred_on', { ascending: false })
    .order('created_at', { ascending: false })
    .range(filters.from, filters.to)

  if (filters.category) {
    query = query.eq('category', filters.category)
  }

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,vendor.ilike.%${filters.search}%,reference.ilike.%${filters.search}%`)
  }

  const { data, error, count } = await query

  if (error) {
    throw new AppError('We could not load expenses.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return { rows: data ?? [], total: count ?? 0 }
}

export async function findExpenseByUuid(client: Client, uuid: string) {
  const { data, error } = await client
    .from('expenses')
    .select(EXPENSE_SELECT)
    .eq('uuid', uuid)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that expense.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function findExpenseIdentity(client: Client, uuid: string) {
  const { data, error } = await client
    .from('expenses')
    .select('id, uuid, status')
    .eq('uuid', uuid)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that expense.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function insertExpense(client: Client, values: Database['public']['Tables']['expenses']['Insert']) {
  const { data, error } = await client
    .from('expenses')
    .insert(values)
    .select(EXPENSE_SELECT)
    .single()

  if (error || !data) {
    throw new AppError('We could not save that expense.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function updateExpenseByUuid(
  client: Client,
  uuid: string,
  values: Database['public']['Tables']['expenses']['Update'],
) {
  const { data, error } = await client
    .from('expenses')
    .update(values)
    .eq('uuid', uuid)
    .select(EXPENSE_SELECT)
    .single()

  if (error || !data) {
    throw new AppError('We could not update that expense.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function listRecurringExpenses(client: Client, filters: {
  search?: string
  category?: ExpenseCategory
  status?: RecurringExpenseStatus
  from: number
  to: number
}) {
  let query = client
    .from('recurring_expenses')
    .select(RECURRING_SELECT, { count: 'exact' })
    .order('next_occurrence_on')
    .range(filters.from, filters.to)

  if (filters.category) {
    query = query.eq('category', filters.category)
  }

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.search) {
    query = query.or(`name.ilike.%${filters.search}%,vendor.ilike.%${filters.search}%`)
  }

  const { data, error, count } = await query

  if (error) {
    throw new AppError('We could not load recurring expenses.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return { rows: data ?? [], total: count ?? 0 }
}

export async function findRecurringExpenseByUuid(client: Client, uuid: string) {
  const { data, error } = await client
    .from('recurring_expenses')
    .select(RECURRING_SELECT)
    .eq('uuid', uuid)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that recurring expense.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function listDueRecurringIdentities(client: Client, today: string) {
  const { data, error } = await client
    .from('recurring_expenses')
    .select('id, uuid, name, category, amount, frequency, interval_count, anchor_day, start_on, end_on, next_occurrence_on, vendor, status, notes')
    .eq('status', 'active')
    .lte('next_occurrence_on', today)
    .order('next_occurrence_on')

  if (error) {
    throw new AppError('We could not load due recurring expenses.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}

export async function findRecurringExpenseIdentity(client: Client, uuid: string) {
  const { data, error } = await client
    .from('recurring_expenses')
    .select('id, uuid, name, category, amount, frequency, interval_count, anchor_day, start_on, end_on, next_occurrence_on, vendor, status, notes')
    .eq('uuid', uuid)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that recurring expense.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function insertRecurringExpense(
  client: Client,
  values: Database['public']['Tables']['recurring_expenses']['Insert'],
) {
  const { data, error } = await client
    .from('recurring_expenses')
    .insert(values)
    .select(RECURRING_SELECT)
    .single()

  if (error || !data) {
    throw new AppError('We could not save that recurring expense.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function updateRecurringExpenseByUuid(
  client: Client,
  uuid: string,
  values: Database['public']['Tables']['recurring_expenses']['Update'],
) {
  const { data, error } = await client
    .from('recurring_expenses')
    .update(values)
    .eq('uuid', uuid)
    .select(RECURRING_SELECT)
    .single()

  if (error || !data) {
    throw new AppError('We could not update that recurring expense.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function listOccurrences(client: Client, recurringId: number, from: number, to: number) {
  const { data, error, count } = await client
    .from('expense_occurrences')
    .select(OCCURRENCE_SELECT, { count: 'exact' })
    .eq('recurring_expense_id', recurringId)
    .order('occurs_on', { ascending: false })
    .range(from, to)

  if (error) {
    throw new AppError('We could not load expense occurrences.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return { rows: data ?? [], total: count ?? 0 }
}

export async function findOccurrenceByDate(client: Client, recurringId: number, occursOn: string) {
  const { data, error } = await client
    .from('expense_occurrences')
    .select(OCCURRENCE_SELECT)
    .eq('recurring_expense_id', recurringId)
    .eq('occurs_on', occursOn)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that occurrence.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function insertOccurrence(
  client: Client,
  values: Database['public']['Tables']['expense_occurrences']['Insert'],
) {
  const { data, error } = await client
    .from('expense_occurrences')
    .insert(values)
    .select(OCCURRENCE_SELECT)
    .single()

  if (error || !data) {
    throw new AppError('We could not record that occurrence.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}
