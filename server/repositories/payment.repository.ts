import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../../types/database.types'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

export const PAYMENT_SELECT = `
  id,
  uuid,
  amount,
  currency,
  provider,
  provider_transaction_id,
  status,
  payment_method,
  paid_at,
  metadata,
  created_at,
  rental_id,
  customer_id
`

export async function insertPayment(client: Client, values: Database['public']['Tables']['payment_transactions']['Insert']) {
  const { data, error } = await client
    .from('payment_transactions')
    .insert(values)
    .select(PAYMENT_SELECT)
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      throw new AppError('A payment is already in progress for this rental.', 409, ERROR_CODES.CONFLICT, { cause: error })
    }

    throw new AppError('We could not start that payment.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function updatePaymentByUuid(client: Client, uuid: string, values: Database['public']['Tables']['payment_transactions']['Update']) {
  const { data, error } = await client
    .from('payment_transactions')
    .update(values)
    .eq('uuid', uuid)
    .select(PAYMENT_SELECT)
    .single()

  if (error || !data) {
    throw new AppError('We could not update that payment.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function findPaymentByUuid(client: Client, uuid: string) {
  const { data, error } = await client
    .from('payment_transactions')
    .select(PAYMENT_SELECT)
    .eq('uuid', uuid)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that payment.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function findPaymentByProviderTransaction(client: Client, provider: string, providerTransactionId: string) {
  const { data, error } = await client
    .from('payment_transactions')
    .select(PAYMENT_SELECT)
    .eq('provider', provider)
    .eq('provider_transaction_id', providerTransactionId)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that payment.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function findOpenPaymentByRentalId(client: Client, rentalId: number) {
  const { data, error } = await client
    .from('payment_transactions')
    .select(PAYMENT_SELECT)
    .eq('rental_id', rentalId)
    .in('status', ['pending', 'processing'])
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that payment.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function findPaidPaymentByRentalId(client: Client, rentalId: number) {
  const { data, error } = await client
    .from('payment_transactions')
    .select(PAYMENT_SELECT)
    .eq('rental_id', rentalId)
    .eq('status', 'paid')
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that payment.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function cancelOpenPaymentsByRentalId(client: Client, rentalId: number) {
  const { error } = await client
    .from('payment_transactions')
    .update({ status: 'cancelled' })
    .eq('rental_id', rentalId)
    .in('status', ['pending', 'processing'])

  if (error) {
    throw new AppError('We could not cancel the open payment.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }
}

export async function listPaymentsByRentalId(client: Client, rentalId: number) {
  const { data, error } = await client
    .from('payment_transactions')
    .select(PAYMENT_SELECT)
    .eq('rental_id', rentalId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new AppError('We could not load payments.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}

export function paymentMetadata(value: Json, checkoutUrl: string): Json {
  const current = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  return { ...current, checkoutUrl }
}
