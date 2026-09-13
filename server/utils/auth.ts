import type { H3Event } from 'h3'
import type { JwtPayload } from '@supabase/supabase-js'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { PublicProfile } from '../../types/auth'
import { toPublicProfile } from '../../utils/auth'
import { findProfileByUserId } from '../repositories/profile.repository'
import { AppError, ERROR_CODES } from './errors'
import { isSupabaseConfigured } from './supabase'

function emailFromClaims(user: JwtPayload): string | null {
  return typeof user.email === 'string' ? user.email : null
}

function emailVerifiedFromClaims(user: JwtPayload): boolean {
  return user.email_verified === true || Reflect.get(user, 'email_confirmed') === true
}

export async function requireUser(event: H3Event): Promise<JwtPayload> {
  if (!isSupabaseConfigured()) {
    throw new AppError(
      'The application is not ready to process this request.',
      503,
      ERROR_CODES.INTERNAL_ERROR,
    )
  }

  try {
    const user = await serverSupabaseUser(event)

    if (!user?.sub) {
      throw new AppError('Please sign in to continue.', 401, ERROR_CODES.UNAUTHORIZED)
    }

    return user
  }
  catch (error) {
    if (error instanceof AppError) {
      throw error
    }

    throw new AppError('Please sign in to continue.', 401, ERROR_CODES.UNAUTHORIZED)
  }
}

export async function getCurrentProfile(event: H3Event): Promise<PublicProfile> {
  const user = await requireUser(event)
  const client = await serverSupabaseClient(event)
  const row = await findProfileByUserId(client, user.sub)

  if (!row) {
    throw new AppError('Your profile is not available yet.', 404, ERROR_CODES.NOT_FOUND)
  }

  return toPublicProfile(row, emailFromClaims(user), emailVerifiedFromClaims(user))
}

export async function requireAdmin(event: H3Event): Promise<PublicProfile> {
  const profile = await getCurrentProfile(event)

  if (profile.role !== 'admin') {
    throw new AppError('You do not have access to this resource.', 403, ERROR_CODES.FORBIDDEN)
  }

  return profile
}
