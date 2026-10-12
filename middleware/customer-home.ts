import { accountHomePath } from '~/utils/auth'

export default defineNuxtRouteMiddleware(async () => {
  const { profile, refreshProfile } = useAuth()

  if (!profile.value) {
    await refreshProfile()
  }

  if (profile.value?.role === 'admin' || profile.value?.role === 'commissioner') {
    return navigateTo(accountHomePath(profile.value.role))
  }
})
