import type { H3Event } from 'h3'
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '../../types/database.types'
import { findProfileIdentity } from '../repositories/profile.repository'
import { AppError, ERROR_CODES } from './errors'
import { requireAdmin, requireUser } from './auth'
import { getSupabaseAdminClient } from './supabase'

export async function requireAdminClient(event: H3Event) {
  const profile = await requireAdmin(event)
  const user = await requireUser(event)
  const cookieClient = await serverSupabaseClient<Database>(event)
  const adminClient = getSupabaseAdminClient()
  const identity = await findProfileIdentity(cookieClient, user.sub)
    || await findProfileIdentity(adminClient, user.sub)

  if (!identity) {
    throw new AppError('Your profile is not available yet.', 404, ERROR_CODES.NOT_FOUND)
  }

  return { profile, client: adminClient, profileId: identity.id }
}
