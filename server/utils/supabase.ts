import type { H3Event } from 'h3'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { serverSupabaseClient } from '#supabase/server'
import type { Database } from '../../types/database.types'
import { isUsableSecret } from '../../utils/env'
import { hasUsableSupabaseConfig } from '../../utils/supabase-config'
import { AppError, ERROR_CODES } from './errors'

let adminClient: SupabaseClient<Database> | null = null

export function isSupabaseConfigured(): boolean {
  const config = useRuntimeConfig()
  const url = config.public.supabaseUrl || process.env.NUXT_PUBLIC_SUPABASE_URL || ''
  const anonKey = config.public.supabaseAnonKey
    || process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY
    || process.env.NUXT_PUBLIC_SUPABASE_KEY
    || ''

  return hasUsableSupabaseConfig(url, anonKey)
}

export function getSupabaseAdminClient(): SupabaseClient<Database> {
  if (adminClient) {
    return adminClient
  }

  const config = useRuntimeConfig()
  const url = config.public.supabaseUrl || process.env.NUXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = config.supabaseServiceRoleKey
    || process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY

  if (!isUsableSecret(url) || !isUsableSecret(serviceRoleKey)) {
    throw new AppError(
      'The application is not ready to process this request.',
      503,
      ERROR_CODES.INTERNAL_ERROR,
    )
  }

  adminClient = createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })

  return adminClient
}

export async function getPublicSupabaseClient(event: H3Event) {
  if (!isSupabaseConfigured()) {
    throw new AppError(
      'The application is not ready to process this request.',
      503,
      ERROR_CODES.INTERNAL_ERROR,
    )
  }

  return serverSupabaseClient<Database>(event)
}
