import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

export async function findEmailLogByHash(client: Client, template: string, payloadHash: string) {
  const { data, error } = await client
    .from('email_logs')
    .select('uuid, status, provider_id, sent_at')
    .eq('template', template)
    .eq('payload_hash', payloadHash)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not check that email log.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function insertEmailLog(client: Client, values: Database['public']['Tables']['email_logs']['Insert']) {
  const { data, error } = await client
    .from('email_logs')
    .insert(values)
    .select('uuid, status')
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      return null
    }

    throw new AppError('We could not record that email.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function updateEmailLog(
  client: Client,
  uuid: string,
  values: Database['public']['Tables']['email_logs']['Update'],
) {
  const { error } = await client
    .from('email_logs')
    .update(values)
    .eq('uuid', uuid)

  if (error) {
    throw new AppError('We could not update that email log.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }
}
