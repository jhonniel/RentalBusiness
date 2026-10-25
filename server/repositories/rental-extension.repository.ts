import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

const BASE_SELECT = `
  uuid,
  rental_id,
  previous_ends_on,
  ends_on,
  previous_return_at,
  return_at,
  previous_total_amount,
  total_amount,
  added_amount,
  note,
  created_at,
  extended_by_profile:profiles!rental_extensions_extended_by_fkey ( first_name, last_name )
`
const CANCEL_COLUMNS = 'cancelled_at, cancel_reason'
const EDIT_COLUMNS = 'edited_at'

type ExtensionRow = {
  uuid: string
  rental_id: number
  previous_ends_on: string
  ends_on: string
  previous_return_at: string | null
  return_at: string
  previous_total_amount: number
  total_amount: number
  added_amount: number
  note: string | null
  created_at: string
  cancelled_at?: string | null
  cancel_reason?: string | null
  edited_at?: string | null
  extended_by_profile: { first_name: string, last_name: string } | { first_name: string, last_name: string }[] | null
}

function isMissingTable(error: { code?: string } | null) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

function isMissingColumn(error: { code?: string } | null) {
  return error?.code === '42703' || error?.code === 'PGRST204'
}

function missingTableError(error: unknown, message: string) {
  return new AppError(message, 409, ERROR_CODES.CONFLICT, { cause: error })
}

export async function listRentalExtensions(client: Client, rentalId: number): Promise<ExtensionRow[]> {
  const query = (select: string) => client
    .from('rental_extensions')
    .select(select)
    .eq('rental_id', rentalId)
    .order('created_at', { ascending: false })

  let { data, error } = await query(`${BASE_SELECT}, ${CANCEL_COLUMNS}, ${EDIT_COLUMNS}`)
  if (isMissingColumn(error)) {
    ({ data, error } = await query(`${BASE_SELECT}, ${CANCEL_COLUMNS}`))
  }
  if (isMissingColumn(error)) {
    ({ data, error } = await query(BASE_SELECT))
  }

  if (error) {
    if (isMissingTable(error)) {
      throw missingTableError(error, 'Paste the rental extensions SQL in Supabase to turn on the extension log.')
    }
    throw new AppError('We could not load the extension log.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return (data ?? []) as unknown as ExtensionRow[]
}

export async function listExtensionAmountsByRentalIds(client: Client, rentalIds: number[]) {
  if (!rentalIds.length) {
    return []
  }

  const query = (select: string) => client
    .from('rental_extensions')
    .select(select)
    .in('rental_id', rentalIds)

  let { data, error } = await query('rental_id, uuid, added_amount, created_at, cancelled_at')
  if (isMissingColumn(error)) {
    ({ data, error } = await query('rental_id, uuid, added_amount, created_at'))
  }
  if (error) {
    if (isMissingTable(error)) {
      return []
    }
    throw new AppError('We could not load booking extensions.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return (data ?? []) as unknown as Array<{
    rental_id: number
    uuid: string
    added_amount: number
    created_at: string
    cancelled_at?: string | null
  }>
}

export async function listExtensionStartsByRentalIds(client: Client, rentalIds: number[]) {
  if (!rentalIds.length) {
    return []
  }

  const query = (select: string) => client
    .from('rental_extensions')
    .select(select)
    .in('rental_id', rentalIds)
    .order('created_at', { ascending: true })

  let { data, error } = await query('rental_id, previous_ends_on, previous_return_at, cancelled_at')
  if (isMissingColumn(error)) {
    ({ data, error } = await query('rental_id, previous_ends_on, previous_return_at'))
  }
  if (error) {
    if (isMissingTable(error)) {
      return []
    }
    throw new AppError('We could not load booking extensions.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return (data ?? []) as unknown as Array<{
    rental_id: number
    previous_ends_on: string
    previous_return_at: string | null
    cancelled_at?: string | null
  }>
}

export async function findRentalExtension(client: Client, uuid: string): Promise<ExtensionRow | null> {
  const { data, error } = await client
    .from('rental_extensions')
    .select(`${BASE_SELECT}, ${CANCEL_COLUMNS}`)
    .eq('uuid', uuid)
    .maybeSingle()

  if (error) {
    if (isMissingTable(error) || isMissingColumn(error)) {
      throw missingTableError(error, 'Paste the rental extension cancel SQL in Supabase before cancelling an extension.')
    }
    throw new AppError('We could not load that extension.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data as unknown as ExtensionRow | null
}

export async function insertRentalExtension(
  client: Client,
  values: Database['public']['Tables']['rental_extensions']['Insert'],
) {
  const { error } = await client
    .from('rental_extensions')
    .insert(values)

  if (error) {
    if (isMissingTable(error)) {
      throw missingTableError(error, 'Paste the rental extensions SQL in Supabase before extending a booking.')
    }
    throw new AppError('We could not record that extension.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }
}

export async function updateRentalExtension(
  client: Client,
  uuid: string,
  values: Database['public']['Tables']['rental_extensions']['Update'],
) {
  const { data, error } = await client
    .from('rental_extensions')
    .update(values)
    .eq('uuid', uuid)
    .is('cancelled_at', null)
    .select('uuid')
    .maybeSingle()

  if (error) {
    if (isMissingColumn(error) || error.code === '42501') {
      throw missingTableError(error, 'Paste the rental extension edit SQL in Supabase before editing an extension.')
    }
    throw new AppError('We could not update that extension.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  if (!data) {
    throw new AppError('A cancelled extension cannot be edited.', 409, ERROR_CODES.CONFLICT)
  }
}

export async function markRentalExtensionCancelled(
  client: Client,
  uuid: string,
  values: { cancelledBy: number, reason: string | null },
) {
  const { data, error } = await client
    .from('rental_extensions')
    .update({
      cancelled_at: new Date().toISOString(),
      cancelled_by: values.cancelledBy,
      cancel_reason: values.reason,
    })
    .eq('uuid', uuid)
    .is('cancelled_at', null)
    .select('uuid')
    .maybeSingle()

  if (error) {
    if (isMissingColumn(error)) {
      throw missingTableError(error, 'Paste the rental extension cancel SQL in Supabase before cancelling an extension.')
    }
    throw new AppError('We could not cancel that extension.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  if (!data) {
    throw new AppError('That extension is already cancelled.', 409, ERROR_CODES.CONFLICT)
  }
}
