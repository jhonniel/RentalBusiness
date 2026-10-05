import { getSupabaseAdminClient } from './supabase'

export async function accountEmail(userId: string | null | undefined) {
  if (!userId) {
    return null
  }

  const { data, error } = await getSupabaseAdminClient().auth.admin.getUserById(userId)
  if (error || !data.user?.email) {
    return null
  }

  return data.user.email
}

export async function accountEmails(userIds: Array<string | null | undefined>) {
  const unique = [...new Set(userIds.filter((id): id is string => Boolean(id)))]
  const entries = await Promise.all(unique.map(async (userId) => {
    return [userId, await accountEmail(userId)] as const
  }))

  return new Map(entries)
}
