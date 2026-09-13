import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { listNotifications, markNotificationRead } from '../repositories/notification.repository'

type Client = SupabaseClient<Database>

export function toPublicNotification(row: {
  uuid: string
  type: string
  title: string
  body: string
  read_at: string | null
  created_at: string
}) {
  return {
    uuid: row.uuid,
    type: row.type,
    title: row.title,
    body: row.body,
    readAt: row.read_at,
    createdAt: row.created_at,
  }
}

export async function listOwnNotifications(client: Client, query: { page: number, pageSize: number }) {
  const from = (query.page - 1) * query.pageSize
  const { rows, total } = await listNotifications(client, from, from + query.pageSize - 1)
  return {
    items: rows.map(toPublicNotification),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function readOwnNotification(client: Client, uuid: string) {
  const row = await markNotificationRead(client, uuid)
  return toPublicNotification(row)
}
