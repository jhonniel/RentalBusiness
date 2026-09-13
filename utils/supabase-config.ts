import { isUsableSecret } from './env'

export const SUPABASE_MODULE_FALLBACK_URL = 'https://placeholder.supabase.co'
export const SUPABASE_MODULE_FALLBACK_KEY = 'sb_publishable_placeholder'

export function hasUsableSupabaseConfig(url?: string, anonKey?: string): boolean {
  return isUsableSecret(url) && isUsableSecret(anonKey)
}

export function supabaseModuleUrl(url?: string) {
  return isUsableSecret(url) ? url : SUPABASE_MODULE_FALLBACK_URL
}

export function supabaseModuleKey(key?: string) {
  return isUsableSecret(key) ? key : SUPABASE_MODULE_FALLBACK_KEY
}
