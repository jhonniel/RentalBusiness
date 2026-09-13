import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { APP_NAME, BUSINESS_CURRENCY, BUSINESS_TIMEZONE } from '../../utils/constants'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

const BUSINESS_SELECT = 'uuid, name, email, phone, address, currency, timezone, late_fee_policy, deposit_rules, cancellation_rules'

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

export async function findBusinessSettings(client: Client) {
  const { data, error } = await client
    .from('business_profiles')
    .select(BUSINESS_SELECT)
    .eq('id', 1)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load settings.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function saveBusinessSettings(client: Client, values: {
  name: string
  email: string | null
  phone: string | null
  address: string | null
  late_fee_policy: string | null
  deposit_rules: string | null
  cancellation_rules: string | null
}) {
  const existing = await findBusinessSettings(client)
  const payload = {
    ...values,
    currency: BUSINESS_CURRENCY,
    timezone: BUSINESS_TIMEZONE,
  }

  const query = existing
    ? client.from('business_profiles').update(payload).eq('id', 1)
    : client.from('business_profiles').insert(payload)

  const { data, error } = await query.select(BUSINESS_SELECT).single()

  if (error || !data) {
    throw new AppError('We could not save settings.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}
