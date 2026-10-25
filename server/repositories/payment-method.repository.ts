import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { PaymentMethodRow } from '../../utils/payment-method'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

const BASE_SELECT = 'uuid, code, name, account_name, account_number, instructions, qr_storage_path, sort_order, is_active'
const METHOD_SELECT = `${BASE_SELECT}, logo_storage_path`

function table(client: Client) {
  return (client as unknown as SupabaseClient).from('payment_methods')
}

function isMissingColumn(error: { code?: string } | null) {
  return error?.code === '42703' || error?.code === 'PGRST204'
}

async function withLogoFallback<T>(run: (select: string) => PromiseLike<{ data: T, error: { code?: string } | null }>) {
  const first = await run(METHOD_SELECT)
  return isMissingColumn(first.error) ? run(BASE_SELECT) : first
}

export async function listPaymentMethods(client: Client, activeOnly = false): Promise<PaymentMethodRow[]> {
  const { data, error } = await withLogoFallback((select) => {
    let query = table(client)
      .select(select)
      .order('sort_order')
      .order('name')
    if (activeOnly) {
      query = query.eq('is_active', true)
    }
    return query
  })

  if (error) {
    throw new AppError('We could not load payment methods.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return (data ?? []) as unknown as PaymentMethodRow[]
}

export async function findPaymentMethodByUuid(client: Client, uuid: string): Promise<PaymentMethodRow | null> {
  const { data, error } = await withLogoFallback(select => table(client)
    .select(select)
    .eq('uuid', uuid)
    .maybeSingle())

  if (error) {
    throw new AppError('We could not load that payment method.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return (data as unknown as PaymentMethodRow | null) ?? null
}

export async function createPaymentMethod(client: Client, input: {
  name: string
  code: string
  accountName: string | null
  accountNumber: string | null
  instructions: string | null
  sortOrder: number
  isActive: boolean
}): Promise<PaymentMethodRow> {
  const { data, error } = await withLogoFallback(select => table(client)
    .insert({
      name: input.name,
      code: input.code,
      account_name: input.accountName,
      account_number: input.accountNumber,
      instructions: input.instructions,
      sort_order: input.sortOrder,
      is_active: input.isActive,
    })
    .select(select)
    .single())

  if (error || !data) {
    throw new AppError('We could not create that payment method.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data as unknown as PaymentMethodRow
}

export async function updatePaymentMethod(client: Client, uuid: string, input: {
  name: string
  code: string
  accountName: string | null
  accountNumber: string | null
  instructions: string | null
  qrStoragePath?: string | null
  logoStoragePath?: string | null
  sortOrder: number
  isActive: boolean
}): Promise<PaymentMethodRow> {
  const payload: Record<string, unknown> = {
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
  if (input.logoStoragePath !== undefined) {
    payload.logo_storage_path = input.logoStoragePath
  }

  const { data, error } = await (input.logoStoragePath !== undefined
    ? table(client).update(payload).eq('uuid', uuid).select(METHOD_SELECT).single()
    : withLogoFallback(select => table(client).update(payload).eq('uuid', uuid).select(select).single()))

  if (error || !data) {
    if (isMissingColumn(error)) {
      throw new AppError('Paste the payment method logo SQL in Supabase to turn on logos.', 409, ERROR_CODES.CONFLICT, { cause: error })
    }
    throw new AppError('We could not update that payment method.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data as unknown as PaymentMethodRow
}
