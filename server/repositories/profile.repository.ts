import type { SupabaseClient } from '@supabase/supabase-js'
import type { ProfileRow } from '../../types/auth'
import type { Database } from '../../types/database.types'
import { AppError, ERROR_CODES } from '../utils/errors'

type TypedClient = SupabaseClient<Database>

export async function findProfileIdentity(
  client: TypedClient,
  userId: string,
) {
  const { data, error } = await client
    .from('profiles')
    .select('id, uuid, user_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new AppError(
      'We could not load your profile.',
      500,
      ERROR_CODES.INTERNAL_ERROR,
      { cause: error },
    )
  }

  return data
}

export async function findProfileById(
  client: TypedClient,
  id: number,
) {
  const { data, error } = await client
    .from('profiles')
    .select('id, uuid, user_id, first_name, last_name, phone')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    throw new AppError(
      'We could not load that profile.',
      500,
      ERROR_CODES.INTERNAL_ERROR,
      { cause: error },
    )
  }

  return data
}

export async function findProfileByUserId(
  client: TypedClient,
  userId: string,
): Promise<ProfileRow | null> {
  const { data, error } = await client
    .from('profiles')
    .select('uuid, user_id, role, first_name, last_name, phone, privacy_policy_version, privacy_accepted_at, terms_version, terms_accepted_at, marketing_opt_in')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    throw new AppError(
      'We could not load your profile.',
      500,
      ERROR_CODES.INTERNAL_ERROR,
      { cause: error },
    )
  }

  return data
}

export async function updateOwnProfile(
  client: TypedClient,
  userId: string,
  input: {
    firstName: string
    lastName: string
    phone: string | null
    marketingOptIn?: boolean
    privacyPolicyVersion?: string | null
    privacyAcceptedAt?: string | null
    termsVersion?: string | null
    termsAcceptedAt?: string | null
    marketingOptedAt?: string | null
  },
): Promise<ProfileRow> {
  const values: Database['public']['Tables']['profiles']['Update'] = {
    first_name: input.firstName,
    last_name: input.lastName,
    phone: input.phone,
  }

  if (input.marketingOptIn !== undefined) {
    values.marketing_opt_in = input.marketingOptIn
    values.marketing_opted_at = input.marketingOptedAt ?? new Date().toISOString()
  }

  if (input.privacyPolicyVersion) {
    values.privacy_policy_version = input.privacyPolicyVersion
    values.privacy_accepted_at = input.privacyAcceptedAt ?? new Date().toISOString()
  }

  if (input.termsVersion) {
    values.terms_version = input.termsVersion
    values.terms_accepted_at = input.termsAcceptedAt ?? new Date().toISOString()
  }

  const { data, error } = await client
    .from('profiles')
    .update(values)
    .eq('user_id', userId)
    .select('uuid, user_id, role, first_name, last_name, phone, privacy_policy_version, privacy_accepted_at, terms_version, terms_accepted_at, marketing_opt_in')
    .single()

  if (error || !data) {
    throw new AppError(
      'We could not update your profile.',
      400,
      ERROR_CODES.VALIDATION_ERROR,
      { cause: error },
    )
  }

  return data
}

export async function stampPrivacyAcknowledgment(
  client: TypedClient,
  profileId: number,
  version: string,
) {
  const { error } = await client
    .from('profiles')
    .update({
      privacy_policy_version: version,
      privacy_accepted_at: new Date().toISOString(),
    })
    .eq('id', profileId)

  if (error) {
    throw new AppError(
      'We could not record that privacy acknowledgment.',
      400,
      ERROR_CODES.VALIDATION_ERROR,
      { cause: error },
    )
  }
}

export async function stampTermsAcceptance(
  client: TypedClient,
  profileId: number,
  version: string,
) {
  const { error } = await client
    .from('profiles')
    .update({
      terms_version: version,
      terms_accepted_at: new Date().toISOString(),
    })
    .eq('id', profileId)

  if (error) {
    throw new AppError(
      'We could not record that Terms acceptance.',
      400,
      ERROR_CODES.VALIDATION_ERROR,
      { cause: error },
    )
  }
}
