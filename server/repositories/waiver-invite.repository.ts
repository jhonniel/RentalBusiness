import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

export async function insertWaiverInvite(
  client: Client,
  values: Database['public']['Tables']['rental_waiver_invites']['Insert'],
) {
  const { data, error } = await client
    .from('rental_waiver_invites')
    .insert(values)
    .select('uuid, email, expires_at, used_at, created_at')
    .single()

  if (error || !data) {
    throw new AppError('We could not create that waiver link.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function findWaiverInviteByUuid(client: Client, uuid: string) {
  const { data, error } = await client
    .from('rental_waiver_invites')
    .select('uuid, rental_id, token_hash, email, expires_at, used_at')
    .eq('uuid', uuid)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that waiver link.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function expireOpenWaiverInvites(client: Client, rentalId: number) {
  const { error } = await client
    .from('rental_waiver_invites')
    .update({ expires_at: new Date().toISOString() })
    .eq('rental_id', rentalId)
    .is('used_at', null)

  if (error) {
    throw new AppError('We could not replace the previous waiver link.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }
}

export async function reopenLatestWaiverInvite(client: Client, rentalId: number, expiresAt: string) {
  const { data, error } = await client
    .from('rental_waiver_invites')
    .select('uuid')
    .eq('rental_id', rentalId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not reopen that waiver link.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  if (!data) {
    return null
  }

  const { error: updateError } = await client
    .from('rental_waiver_invites')
    .update({
      used_at: null,
      expires_at: expiresAt,
    })
    .eq('uuid', data.uuid)

  if (updateError) {
    throw new AppError('We could not reopen that waiver link.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: updateError })
  }

  return data.uuid
}

export async function markWaiverInviteUsed(client: Client, uuid: string) {
  const { error } = await client
    .from('rental_waiver_invites')
    .update({ used_at: new Date().toISOString() })
    .eq('uuid', uuid)
    .is('used_at', null)

  if (error) {
    throw new AppError('We could not close that waiver link.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }
}
