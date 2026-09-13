import type { H3Event } from 'h3'
import { createClient, type JwtPayload } from '@supabase/supabase-js'
import { serverSupabaseClient, serverSupabaseUser } from '#supabase/server'
import type { PublicProfile } from '../../types/auth'
import { toPublicProfile } from '../../utils/auth'
import { findProfileByUserId } from '../repositories/profile.repository'
import { AppError, ERROR_CODES } from './errors'
import { getSupabaseAdminClient, isSupabaseConfigured } from './supabase'

function emailFromClaims(user: JwtPayload): string | null {
  return typeof user.email === 'string' ? user.email : null
}

function emailVerifiedFromClaims(user: JwtPayload): boolean {
  return user.email_verified === true || Reflect.get(user, 'email_confirmed') === true
}

async function userFromBearer(event: H3Event): Promise<JwtPayload | null> {
  const header = getHeader(event, 'authorization')
  if (!header || !header.toLowerCase().startsWith('bearer ')) {
    return null
  }

  const token = header.slice(7).trim()
  if (!token) {
    return null
  }

  const config = useRuntimeConfig()
  const url = String(config.public.supabaseUrl || '')
  const anonKey = String(config.public.supabaseAnonKey || '')
  if (!url || !anonKey) {
    return null
  }

  const client = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
  const { data, error } = await client.auth.getUser(token)

  if (error || !data.user?.id) {
    return null
  }

  return {
    sub: data.user.id,
    email: data.user.email,
    email_verified: Boolean(data.user.email_confirmed_at),
  } as JwtPayload
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
    if (user?.sub) {
      return user
    }
  }
  catch {
    // Cookie session is missing after client-side Google/email sign-in. Try the access token.
  }

  const fromBearer = await userFromBearer(event)
  if (fromBearer?.sub) {
    return fromBearer
  }

  throw new AppError('Please sign in to continue.', 401, ERROR_CODES.UNAUTHORIZED)
}

export async function getCurrentProfile(event: H3Event): Promise<PublicProfile> {
  const user = await requireUser(event)
  const client = await serverSupabaseClient(event)
  const row = await findProfileByUserId(client, user.sub)
    || await findProfileByUserId(getSupabaseAdminClient(), user.sub)

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
