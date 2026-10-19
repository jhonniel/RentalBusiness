import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

const EXTENSION_SELECT = `
  uuid,
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

function isMissingTable(error: { code?: string } | null) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

export async function listRentalExtensions(client: Client, rentalId: number) {
  const { data, error } = await client
    .from('rental_extensions')
    .select(EXTENSION_SELECT)
    .eq('rental_id', rentalId)
    .order('created_at', { ascending: false })

  if (error) {
    if (isMissingTable(error)) {
      throw new AppError(
        'Paste the rental extensions SQL in Supabase to turn on the extension log.',
        409,
        ERROR_CODES.CONFLICT,
        { cause: error },
      )
    }
    throw new AppError('We could not load the extension log.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
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
      throw new AppError(
        'Paste the rental extensions SQL in Supabase before extending a booking.',
        409,
        ERROR_CODES.CONFLICT,
        { cause: error },
      )
    }
    throw new AppError('We could not record that extension.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }
}
