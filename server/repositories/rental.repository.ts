import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { CalendarRentalStatus, RentalStatus } from '../../utils/constants'
import { CALENDAR_RENTAL_STATUSES } from '../../utils/constants'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

const RENTAL_SELECT = `
  uuid,
  code,
  status,
  starts_on,
  ends_on,
  subtotal,
  deposit_amount,
  discount_amount,
  tax_amount,
  total_amount,
  notes,
  created_at,
  rental_identity_verifications (
    submitted_at
  ),
  rental_items (
    uuid,
    quantity,
    daily_price,
    line_total,
    products (
      uuid,
      slug,
      name,
      sku
    )
  ),
  waiver_acceptances (
    uuid,
    signer_name,
    signer_email,
    signer_phone,
    accepted_at,
    privacy_policy_version,
    terms_version,
    waiver_versions (
      uuid,
      version,
      title,
      body
    )
  ),
  payment_transactions (
    uuid,
    amount,
    currency,
    provider,
    status,
    payment_method,
    paid_at,
    metadata,
    created_at
  ),
  receipts (
    uuid,
    receipt_number,
    issued_at,
    snapshot
  ),
  profiles (
    uuid,
    first_name,
    last_name,
    phone
  )
`

const CALENDAR_SELECT = `
  uuid,
  code,
  status,
  starts_on,
  ends_on,
  rental_items (
    products (
      name
    )
  ),
  profiles (
    first_name,
    last_name
  )
`

export async function insertRentalRequest(client: Client, values: Database['public']['Tables']['rental_requests']['Insert']) {
  const { data, error } = await client
    .from('rental_requests')
    .insert(values)
    .select('id, uuid, code')
    .single()

  if (error || !data) {
    throw new AppError('We could not create that rental.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function insertRentalItem(client: Client, values: Database['public']['Tables']['rental_items']['Insert']) {
  const { data, error } = await client
    .from('rental_items')
    .insert(values)
    .select('uuid')
    .single()

  if (error || !data) {
    throw new AppError('We could not add that equipment to the rental.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function deleteRentalById(client: Client, id: number) {
  const { error } = await client
    .from('rental_requests')
    .delete()
    .eq('id', id)

  if (error) {
    throw new AppError('We could not remove that draft rental.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }
}

export async function updateRentalStatus(client: Client, uuid: string, status: RentalStatus) {
  const { data, error } = await client
    .from('rental_requests')
    .update({ status })
    .eq('uuid', uuid)
    .select(RENTAL_SELECT)
    .single()

  if (error || !data) {
    throw new AppError('We could not update that rental.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function insertRentalStatusHistory(client: Client, values: {
  rentalId: number
  fromStatus: string | null
  toStatus: string
  changedBy?: number | null
  note?: string
}) {
  const { error } = await client
    .from('rental_status_history')
    .insert({
      rental_id: values.rentalId,
      from_status: values.fromStatus,
      to_status: values.toStatus,
      changed_by: values.changedBy ?? null,
      note: values.note ?? null,
    })

  if (error) {
    throw new AppError('We could not record the rental status.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }
}

export async function findRentalByUuid(client: Client, uuid: string) {
  const { data, error } = await client
    .from('rental_requests')
    .select(RENTAL_SELECT)
    .eq('uuid', uuid)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that rental.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function findRentalByCode(client: Client, code: string) {
  const { data, error } = await client
    .from('rental_requests')
    .select(RENTAL_SELECT)
    .eq('code', code)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that rental.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function findRentalIdentityById(client: Client, id: number) {
  const { data, error } = await client
    .from('rental_requests')
    .select('id, uuid, code, status, customer_id')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that rental.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function findRentalIdentity(client: Client, uuid: string) {
  const { data, error } = await client
    .from('rental_requests')
    .select('id, uuid, code, status, customer_id')
    .eq('uuid', uuid)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that rental.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function listRentals(client: Client, filters: {
  status?: RentalStatus
  search?: string
  from: number
  to: number
}) {
  let query = client
    .from('rental_requests')
    .select(RENTAL_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(filters.from, filters.to)

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (filters.search) {
    query = query.ilike('code', `%${filters.search}%`)
  }

  const { data, error, count } = await query

  if (error) {
    throw new AppError('We could not load rentals.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return { rows: data ?? [], total: count ?? 0 }
}

export async function listRentalsByDate(client: Client, filters: {
  statuses: RentalStatus[]
  column: 'starts_on' | 'ends_on'
  on: string
  before?: boolean
}) {
  let query = client
    .from('rental_requests')
    .select('uuid, code, status, starts_on, ends_on, customer_id')
    .in('status', filters.statuses)

  query = filters.before
    ? query.lt(filters.column, filters.on)
    : query.eq(filters.column, filters.on)

  const { data, error } = await query

  if (error) {
    throw new AppError('We could not load scheduled rentals.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}

export async function listRentalsOverlapping(client: Client, filters: {
  startsOn: string
  endsOn: string
  status?: CalendarRentalStatus
}) {
  let query = client
    .from('rental_requests')
    .select(CALENDAR_SELECT)
    .lte('starts_on', filters.endsOn)
    .gte('ends_on', filters.startsOn)
    .order('starts_on', { ascending: true })
    .limit(300)

  query = filters.status
    ? query.eq('status', filters.status)
    : query.in('status', [...CALENDAR_RENTAL_STATUSES])

  const { data, error } = await query

  if (error) {
    throw new AppError('We could not load the rental calendar.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}
