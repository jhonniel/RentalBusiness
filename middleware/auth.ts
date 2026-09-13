import { needsPolicyAcceptance } from '~/utils/auth'

export default defineNuxtRouteMiddleware(async (to) => {
  const session = useSupabaseSession()

  if (!session.value) {
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath },
    })
  }

  if (to.path === '/accept-policies') {
    return
  }

  const { profile, refreshProfile } = useAuth()
  if (!profile.value) {
    await refreshProfile()
  }

  if (needsPolicyAcceptance(profile.value)) {
    return navigateTo({
      path: '/accept-policies',
      query: { redirect: to.fullPath },
    })
  }
})
