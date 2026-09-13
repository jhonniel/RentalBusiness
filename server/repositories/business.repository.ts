import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { APP_NAME, BUSINESS_CURRENCY } from '../../utils/constants'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

export async function findBusinessProfile(client: Client) {
  const { data, error } = await client
    .from('business_profiles')
    .select('name, email, phone, address, currency')
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load the business profile.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? {
    name: APP_NAME,
    email: null,
    phone: null,
    address: null,
    currency: BUSINESS_CURRENCY,
  }
}
