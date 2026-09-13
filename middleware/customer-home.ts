import { accountHomePath } from '~/utils/auth'

export default defineNuxtRouteMiddleware(async () => {
  const { profile, refreshProfile } = useAuth()

  if (!profile.value) {
    await refreshProfile()
  }

  if (profile.value?.role === 'admin') {
    return navigateTo(accountHomePath('admin'))
  }
})
