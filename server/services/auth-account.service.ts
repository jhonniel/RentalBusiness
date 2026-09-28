import { createClient, type JwtPayload } from '@supabase/supabase-js'
import type { H3Event } from 'h3'
import type { PublicProfile } from '../../types/auth'
import type { Database } from '../../types/database.types'
import type { ChangePasswordInput } from '../../utils/auth-validation'
import { hasUsableSupabaseConfig } from '../../utils/supabase-config'
import { recordAudit } from '../utils/audit'
import { AppError, ERROR_CODES } from '../utils/errors'
import { getSupabaseAdminClient } from '../utils/supabase'

function createPasswordCheckClient() {
  const config = useRuntimeConfig()
  const url = String(config.public.supabaseUrl || process.env.NUXT_PUBLIC_SUPABASE_URL || '')
  const anonKey = String(
    config.public.supabaseAnonKey
    || process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY
    || process.env.NUXT_PUBLIC_SUPABASE_KEY
    || '',
  )

  if (!hasUsableSupabaseConfig(url, anonKey)) {
    throw new AppError(
      'The application is not ready to process this request.',
      503,
      ERROR_CODES.INTERNAL_ERROR,
    )
  }

  return createClient<Database>(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

export async function changeOwnPassword(
  event: H3Event,
  user: JwtPayload,
  profile: PublicProfile,
  input: ChangePasswordInput,
) {
  const email = typeof user.email === 'string' ? user.email : null
  if (!email) {
    throw new AppError(
      'Your account does not have an email sign-in.',
      409,
      ERROR_CODES.CONFLICT,
    )
  }

  const check = createPasswordCheckClient()
  const { error: currentError } = await check.auth.signInWithPassword({
    email,
    password: input.currentPassword,
  })

  if (currentError) {
    throw new AppError('Current password is incorrect.', 401, ERROR_CODES.UNAUTHORIZED)
  }

  const admin = getSupabaseAdminClient()
  const { error } = await admin.auth.admin.updateUserById(user.sub, {
    password: input.password,
  })

  if (error) {
    throw new AppError(
      'We could not update your password.',
      400,
      ERROR_CODES.VALIDATION_ERROR,
      { cause: error },
    )
  }

  await recordAudit(event, admin, {
    action: 'auth.password_change',
    entity: 'profiles',
    entityId: profile.uuid,
    next: { changed: true },
  })

  return { changed: true }
}
