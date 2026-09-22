import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { VoucherStatus } from '../../utils/constants'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

const VOUCHER_SELECT = `
  uuid,
  code,
  name,
  discount_type,
  discount_value,
  max_redemptions,
  redeemed_count,
  min_subtotal,
  starts_on,
  ends_on,
  status,
  created_at
`

export async function listVouchers(client: Client, filters: {
  search?: string
  status?: VoucherStatus
  from: number
  to: number
}) {
  let query = client
    .from('vouchers')
    .select(VOUCHER_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(filters.from, filters.to)

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.search) {
    query = query.or(`code.ilike.%${filters.search}%,name.ilike.%${filters.search}%`)
  }

  const { data, error, count } = await query
  if (error) {
    throw new AppError('We could not load vouchers.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return { rows: data ?? [], total: count ?? 0 }
}

export async function findVoucherByUuid(client: Client, uuid: string) {
  const { data, error } = await client
    .from('vouchers')
    .select(VOUCHER_SELECT)
    .eq('uuid', uuid)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that voucher.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function findVoucherByCode(client: Client, code: string) {
  const { data, error } = await client
    .from('vouchers')
    .select(`id, ${VOUCHER_SELECT}`)
    .eq('code', code)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not check that voucher.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function insertVoucher(client: Client, values: Database['public']['Tables']['vouchers']['Insert']) {
  const { data, error } = await client
    .from('vouchers')
    .insert(values)
    .select(VOUCHER_SELECT)
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      throw new AppError('That voucher code is already in use.', 409, ERROR_CODES.CONFLICT, { cause: error })
    }
    throw new AppError('We could not save that voucher.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function updateVoucherByUuid(
  client: Client,
  uuid: string,
  values: Database['public']['Tables']['vouchers']['Update'],
) {
  const { data, error } = await client
    .from('vouchers')
    .update(values)
    .eq('uuid', uuid)
    .select(VOUCHER_SELECT)
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      throw new AppError('That voucher code is already in use.', 409, ERROR_CODES.CONFLICT, { cause: error })
    }
    throw new AppError('We could not update that voucher.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function incrementVoucherRedemption(client: Client, voucherId: number, maxRedemptions: number | null) {
  const { data: current, error: loadError } = await client
    .from('vouchers')
    .select('redeemed_count')
    .eq('id', voucherId)
    .single()

  if (loadError || !current) {
    throw new AppError('We could not update that voucher.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: loadError })
  }

  if (maxRedemptions !== null && current.redeemed_count >= maxRedemptions) {
    throw new AppError('That voucher has already been used up.', 409, ERROR_CODES.CONFLICT)
  }

  const { error } = await client
    .from('vouchers')
    .update({ redeemed_count: current.redeemed_count + 1 })
    .eq('id', voucherId)

  if (error) {
    throw new AppError('We could not update that voucher.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }
}

export async function decrementVoucherRedemption(client: Client, voucherId: number) {
  const { data: current, error: loadError } = await client
    .from('vouchers')
    .select('redeemed_count')
    .eq('id', voucherId)
    .single()

  if (loadError || !current) {
    return
  }

  await client
    .from('vouchers')
    .update({ redeemed_count: Math.max(0, current.redeemed_count - 1) })
    .eq('id', voucherId)
}

export async function findRedemptionByRentalId(client: Client, rentalId: number) {
  const { data, error } = await client
    .from('voucher_redemptions')
    .select('uuid, voucher_id, code, name, discount_amount')
    .eq('rental_id', rentalId)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that voucher.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function insertRedemption(client: Client, values: Database['public']['Tables']['voucher_redemptions']['Insert']) {
  const { data, error } = await client
    .from('voucher_redemptions')
    .insert(values)
    .select('uuid, code, name, discount_amount')
    .single()

  if (error || !data) {
    throw new AppError('We could not apply that voucher.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function deleteRedemptionByRentalId(client: Client, rentalId: number) {
  const { error } = await client
    .from('voucher_redemptions')
    .delete()
    .eq('rental_id', rentalId)

  if (error) {
    throw new AppError('We could not remove that voucher.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }
}
