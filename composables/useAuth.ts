import type { PublicProfile } from '~/types/auth'
import { AUTH_NEXT_STORAGE_KEY, extractAuthErrorMessage, mapAuthError, rememberPendingPolicies, safeRedirectPath } from '~/utils/auth'
import { hasUsableSupabaseConfig } from '~/utils/supabase-config'

export function useAuth() {
  const user = useSupabaseUser()
  const session = useSupabaseSession()
  const supabase = useSupabaseClient()
  const config = useRuntimeConfig()
  const toast = useToast()
  const profile = useState<PublicProfile | null>('auth-profile', () => null)

  const isAuthenticated = computed(() => Boolean(session.value))
  const isAdmin = computed(() => profile.value?.role === 'admin')
  const isConfigured = computed(() => hasUsableSupabaseConfig(
    config.public.supabaseUrl,
    config.public.supabaseAnonKey,
  ))

  async function refreshProfile() {
    if (!session.value) {
      profile.value = null
      return null
    }

    try {
      profile.value = await $fetch('/api/auth/me')
      return profile.value
    }
    catch {
      profile.value = null
      return null
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    profile.value = null
    toast.add({
      title: 'Signed out',
      color: 'success',
    })
    await navigateTo('/')
  }

  function authErrorMessage(error: unknown) {
    return mapAuthError(extractAuthErrorMessage(error))
  }

  function redirectAfterLogin(requested?: unknown) {
    if (isSafeCustomRedirect(requested)) {
      return safeRedirectPath(requested)
    }

    return isAdmin.value ? '/admin' : '/dashboard'
  }

  async function signInWithGoogle(options: {
    redirect?: unknown
    policies?: {
      termsAccepted: boolean
      privacyAcknowledged: boolean
      marketingOptIn?: boolean
    }
  } = {}) {
    if (!isConfigured.value) {
      throw new Error('Authentication is not configured yet. Add your Supabase keys to continue.')
    }

    if (import.meta.client) {
      if (isSafeCustomRedirect(options.redirect)) {
        sessionStorage.setItem(AUTH_NEXT_STORAGE_KEY, options.redirect)
      }
      else {
        sessionStorage.removeItem(AUTH_NEXT_STORAGE_KEY)
      }

      if (options.policies) {
        rememberPendingPolicies(options.policies)
      }
    }

    const origin = String(config.public.siteUrl || 'http://localhost:3000')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin.replace(/\/$/, '')}/confirm`,
        queryParams: {
          prompt: 'select_account',
        },
      },
    })

    if (error) {
      throw error
    }
  }

  return {
    user,
    session,
    profile,
    isAuthenticated,
    isAdmin,
    isConfigured,
    refreshProfile,
    logout,
    authErrorMessage,
    redirectAfterLogin,
    signInWithGoogle,
  }
}

function isSafeCustomRedirect(path: unknown) {
  return typeof path === 'string' && path.startsWith('/') && !path.startsWith('//')
}
