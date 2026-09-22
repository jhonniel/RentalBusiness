import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../../types/database.types'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

export async function findSettingByKey(client: Client, key: string) {
  const { data, error } = await client
    .from('settings')
    .select('key, value, updated_at')
    .eq('key', key)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that setting.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function upsertSetting(client: Client, key: string, value: Json) {
  const { data, error } = await client
    .from('settings')
    .upsert({ key, value }, { onConflict: 'key' })
    .select('key, value, updated_at')
    .single()

  if (error || !data) {
    throw new AppError('We could not save that setting.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}
