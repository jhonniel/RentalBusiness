import { needsPolicyAcceptance } from '~/utils/auth'

export default defineNuxtRouteMiddleware(async () => {
  const session = useSupabaseSession()

  if (!session.value) {
    return
  }

  const { profile, refreshProfile, redirectAfterLogin } = useAuth()
  if (!profile.value) {
    await refreshProfile()
  }

  if (needsPolicyAcceptance(profile.value)) {
    return navigateTo('/accept-policies')
  }

  return navigateTo(redirectAfterLogin())
})
