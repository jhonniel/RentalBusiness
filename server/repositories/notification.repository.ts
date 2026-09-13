import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

const NOTIFICATION_SELECT = 'uuid, type, title, body, read_at, created_at, metadata'

export async function listNotifications(client: Client, from: number, to: number) {
  const { data, error, count } = await client
    .from('notifications')
    .select(NOTIFICATION_SELECT, { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to)

  if (error) {
    throw new AppError('We could not load notifications.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return { rows: data ?? [], total: count ?? 0 }
}

export async function insertNotification(client: Client, values: Database['public']['Tables']['notifications']['Insert']) {
  const { error } = await client
    .from('notifications')
    .insert(values)

  if (error) {
    throw new AppError('We could not record that notification.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }
}

export async function markNotificationRead(client: Client, uuid: string) {
  const { data, error } = await client
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('uuid', uuid)
    .select(NOTIFICATION_SELECT)
    .single()

  if (error || !data) {
    throw new AppError('We could not update that notification.', 404, ERROR_CODES.NOT_FOUND, { cause: error })
  }

  return data
}
