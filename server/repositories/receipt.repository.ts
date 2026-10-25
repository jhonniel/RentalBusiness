import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

const RECEIPT_SELECT = 'uuid, receipt_number, issued_at, snapshot, rental_id, payment_id'

export async function insertReceipt(client: Client, values: Database['public']['Tables']['receipts']['Insert']) {
  const { data, error } = await client
    .from('receipts')
    .insert(values)
    .select(RECEIPT_SELECT)
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      throw new AppError('That payment already has a receipt.', 409, ERROR_CODES.CONFLICT, { cause: error })
    }

    throw new AppError('We could not issue that receipt.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function findReceiptByUuid(client: Client, uuid: string) {
  const { data, error } = await client
    .from('receipts')
    .select(RECEIPT_SELECT)
    .eq('uuid', uuid)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that receipt.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function findReceiptByNumber(client: Client, receiptNumber: string) {
  const { data, error } = await client
    .from('receipts')
    .select(RECEIPT_SELECT)
    .eq('receipt_number', receiptNumber)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that receipt.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function listReceiptsByRentalId(client: Client, rentalId: number) {
  const { data, error } = await client
    .from('receipts')
    .select('receipt_number, issued_at, snapshot, payment:payment_transactions ( amount, status, metadata )')
    .eq('rental_id', rentalId)
    .order('issued_at', { ascending: true })

  if (error) {
    throw new AppError('We could not load the payments for this booking.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return (data ?? []).map(row => ({
    ...row,
    payment: Array.isArray(row.payment) ? row.payment[0] ?? null : row.payment,
  }))
}

export async function findReceiptByPaymentId(client: Client, paymentId: number) {
  const { data, error } = await client
    .from('receipts')
    .select(RECEIPT_SELECT)
    .eq('payment_id', paymentId)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that receipt.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}
