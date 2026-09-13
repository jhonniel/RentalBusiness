import type { H3Event } from 'h3'
import { findProfileIdentity } from '../repositories/profile.repository'
import { AppError, ERROR_CODES } from './errors'
import { requireAdmin, requireUser } from './auth'
import { getAuthenticatedSupabaseClient, getSupabaseAdminClient } from './supabase'

export async function requireAdminClient(event: H3Event) {
  const profile = await requireAdmin(event)
  const user = await requireUser(event)
  const sessionClient = await getAuthenticatedSupabaseClient(event)
  const adminClient = getSupabaseAdminClient()
  let identity = null
  try {
    identity = await findProfileIdentity(sessionClient, user.sub)
  }
  catch {
    identity = null
  }
  if (!identity) {
    identity = await findProfileIdentity(adminClient, user.sub)
  }

  if (!identity) {
    throw new AppError('Your profile is not available yet.', 404, ERROR_CODES.NOT_FOUND)
  }

  return { profile, client: adminClient, profileId: identity.id }
}
