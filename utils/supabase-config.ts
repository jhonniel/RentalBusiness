import { isUsableSecret } from './env'

export function hasUsableSupabaseConfig(url?: string, anonKey?: string): boolean {
  return isUsableSecret(url) && isUsableSecret(anonKey)
}
