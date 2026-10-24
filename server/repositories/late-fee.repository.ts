import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { LateFeeRecord as LateFeeRow, LateFeeType } from '../../utils/late-fee'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

const SELECT = 'uuid, rental_id, fee_type, custom_amount, stopped_at, paid_amount, paid_at, voided_at, void_reason'

function table(client: Client) {
  return (client as unknown as SupabaseClient).from('rental_late_fees')
}

function isMissingTable(error: { code?: string } | null) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

export async function findLateFeeByRentalId(client: Client, rentalId: number): Promise<{ row: LateFeeRow | null, available: boolean }> {
  const { data, error } = await table(client)
    .select(SELECT)
    .eq('rental_id', rentalId)
    .maybeSingle()

  if (error) {
    if (isMissingTable(error)) {
      return { row: null, available: false }
    }
    throw new AppError('We could not load the late fee.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return { row: (data as LateFeeRow | null) ?? null, available: true }
}

export async function saveLateFee(client: Client, rentalId: number, values: Partial<{
  fee_type: LateFeeType
  custom_amount: number | null
  stopped_at: string | null
  paid_amount: number | null
  paid_at: string | null
  payment_id: number | null
  voided_at: string | null
  voided_by: number | null
  void_reason: string | null
  updated_by: number | null
}>): Promise<LateFeeRow> {
  const { data, error } = await table(client)
    .upsert({ rental_id: rentalId, ...values, updated_at: new Date().toISOString() }, { onConflict: 'rental_id' })
    .select(SELECT)
    .single()

  if (error || !data) {
    if (isMissingTable(error)) {
      throw new AppError('Paste the rental late fees SQL in Supabase to turn on late fees.', 409, ERROR_CODES.CONFLICT, { cause: error })
    }
    throw new AppError('We could not save the late fee.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data as LateFeeRow
}
