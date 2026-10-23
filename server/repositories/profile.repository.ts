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

export async function findProfileIdentityByUuid(
  client: TypedClient,
  uuid: string,
) {
  const { data, error } = await client
    .from('profiles')
    .select('id, uuid, user_id, role')
    .eq('uuid', uuid)
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

export async function findProfileByUuid(
  client: TypedClient,
  uuid: string,
) {
  const { data, error } = await client
    .from('profiles')
    .select('uuid, user_id, role, first_name, last_name, phone, created_at')
    .eq('uuid', uuid)
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

export async function findProfileKeyByUuid(client: TypedClient, uuid: string) {
  const { data, error } = await client
    .from('profiles')
    .select('id, uuid, role, first_name, last_name')
    .eq('uuid', uuid)
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

export function isMissingDeletedColumn(error: { code?: string, message?: string } | null) {
  return Boolean(error && (error.code === '42703' || error.code === 'PGRST204') && /deleted_at/.test(error.message || ''))
}

export async function isProfileDeleted(client: TypedClient, userId: string) {
  const { data, error } = await client
    .from('profiles')
    .select('deleted_at')
    .eq('user_id', userId)
    .maybeSingle()

  if (error) {
    return false
  }

  return Boolean((data as { deleted_at?: string | null } | null)?.deleted_at)
}

export async function findProfileForDeletion(client: TypedClient, uuid: string) {
  const { data, error } = await client
    .from('profiles')
    .select('id, uuid, user_id, role, first_name, last_name, deleted_at')
    .eq('uuid', uuid)
    .maybeSingle()

  if (error) {
    if (isMissingDeletedColumn(error)) {
      throw new AppError('Paste the profile delete SQL in Supabase before deleting an account.', 409, ERROR_CODES.CONFLICT, { cause: error })
    }
    throw new AppError('We could not load that account.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function countActiveAdmins(client: TypedClient) {
  const { count, error } = await client
    .from('profiles')
    .select('uuid', { count: 'exact', head: true })
    .eq('role', 'admin')
    .is('deleted_at', null)

  if (error) {
    throw new AppError('We could not count system users.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return count ?? 0
}

export async function markProfileDeleted(client: TypedClient, uuid: string, deletedBy: number) {
  const { error } = await client
    .from('profiles')
    .update({ deleted_at: new Date().toISOString(), deleted_by: deletedBy })
    .eq('uuid', uuid)
    .is('deleted_at', null)

  if (error) {
    throw new AppError('We could not delete that account.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }
}

export async function listAdminProfiles(client: TypedClient) {
  const query = (activeOnly: boolean) => {
    let builder = client
      .from('profiles')
      .select('uuid, user_id, first_name, last_name, created_at')
      .eq('role', 'admin')
      .order('created_at', { ascending: true })
    if (activeOnly) {
      builder = builder.is('deleted_at', null)
    }
    return builder
  }
  let { data, error } = await query(true)
  if (isMissingDeletedColumn(error)) {
    ({ data, error } = await query(false))
  }

  if (error) {
    throw new AppError(
      'We could not load system users.',
      500,
      ERROR_CODES.INTERNAL_ERROR,
      { cause: error },
    )
  }

  return data ?? []
}

export async function listCommissionerProfiles(client: TypedClient) {
  const query = (activeOnly: boolean) => {
    let builder = client
      .from('profiles')
      .select('uuid, user_id, first_name, last_name, created_at')
      .eq('role', 'commissioner')
      .order('created_at', { ascending: true })
    if (activeOnly) {
      builder = builder.is('deleted_at', null)
    }
    return builder
  }
  let { data, error } = await query(true)
  if (isMissingDeletedColumn(error)) {
    ({ data, error } = await query(false))
  }

  if (error) {
    throw new AppError(
      'We could not load commissioners.',
      500,
      ERROR_CODES.INTERNAL_ERROR,
      { cause: error },
    )
  }

  return data ?? []
}

export async function promoteProfileToAdmin(client: TypedClient, uuid: string) {
  const { error } = await client.rpc('promote_profile_to_admin', {
    p_profile_uuid: uuid,
  })

  if (error) {
    throw new AppError(
      'We could not make that customer a system user.',
      400,
      ERROR_CODES.VALIDATION_ERROR,
      { cause: error },
    )
  }
}

export async function promoteProfileToCommissioner(client: TypedClient, uuid: string) {
  const { error } = await client.rpc('promote_profile_to_commissioner', {
    p_profile_uuid: uuid,
  })

  if (error) {
    throw new AppError(
      'We could not make that customer a commissioner.',
      400,
      ERROR_CODES.VALIDATION_ERROR,
      { cause: error },
    )
  }
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

export async function listProfileActors(client: TypedClient, ids: number[]) {
  if (!ids.length) {
    return []
  }

  const { data, error } = await client
    .from('profiles')
    .select('id, uuid, first_name, last_name')
    .in('id', ids)

  if (error) {
    throw new AppError(
      'We could not load audit actors.',
      500,
      ERROR_CODES.INTERNAL_ERROR,
      { cause: error },
    )
  }

  return data ?? []
}
