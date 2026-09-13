import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

const METHOD_SELECT = 'uuid, code, name, account_name, account_number, instructions, qr_storage_path, sort_order, is_active'

export async function listPaymentMethods(client: Client, activeOnly = false) {
  let query = client
    .from('payment_methods')
    .select(METHOD_SELECT)
    .order('sort_order')
    .order('name')

  if (activeOnly) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query

  if (error) {
    throw new AppError('We could not load payment methods.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}

export async function findPaymentMethodByUuid(client: Client, uuid: string) {
  const { data, error } = await client
    .from('payment_methods')
    .select(METHOD_SELECT)
    .eq('uuid', uuid)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that payment method.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function createPaymentMethod(client: Client, input: {
  name: string
  code: string
  accountName: string | null
  accountNumber: string | null
  instructions: string | null
  sortOrder: number
  isActive: boolean
}) {
  const { data, error } = await client
    .from('payment_methods')
    .insert({
      name: input.name,
      code: input.code,
      account_name: input.accountName,
      account_number: input.accountNumber,
      instructions: input.instructions,
      sort_order: input.sortOrder,
      is_active: input.isActive,
    })
    .select(METHOD_SELECT)
    .single()

  if (error || !data) {
    throw new AppError('We could not create that payment method.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function updatePaymentMethod(client: Client, uuid: string, input: {
  name: string
  code: string
  accountName: string | null
  accountNumber: string | null
  instructions: string | null
  qrStoragePath?: string | null
  sortOrder: number
  isActive: boolean
}) {
  const payload: {
    name: string
    code: string
    account_name: string | null
    account_number: string | null
    instructions: string | null
    sort_order: number
    is_active: boolean
    qr_storage_path?: string | null
  } = {
    name: input.name,
    code: input.code,
    account_name: input.accountName,
    account_number: input.accountNumber,
    instructions: input.instructions,
    sort_order: input.sortOrder,
    is_active: input.isActive,
  }

  if (input.qrStoragePath !== undefined) {
    payload.qr_storage_path = input.qrStoragePath
  }

  const { data, error } = await client
    .from('payment_methods')
    .update(payload)
    .eq('uuid', uuid)
    .select(METHOD_SELECT)
    .single()

  if (error || !data) {
    throw new AppError('We could not update that payment method.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}
