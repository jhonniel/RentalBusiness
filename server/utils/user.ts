import type { H3Event } from 'h3'
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '../../types/database.types'
import { findProfileIdentity } from '../repositories/profile.repository'
import { AppError, ERROR_CODES } from './errors'
import { getCurrentProfile, requireUser } from './auth'
import { getSupabaseAdminClient } from './supabase'

export async function requireUserClient(event: H3Event) {
  const user = await requireUser(event)
  const profile = await getCurrentProfile(event)
  const client = await serverSupabaseClient<Database>(event)
  const identity = await findProfileIdentity(client, user.sub)
    || await findProfileIdentity(getSupabaseAdminClient(), user.sub)

  if (!identity) {
    throw new AppError('Your profile is not available yet.', 404, ERROR_CODES.NOT_FOUND)
  }

  return { user, profile, client, profileId: identity.id }
}
