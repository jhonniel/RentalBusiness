import type { PublicMaintenanceStatus } from '~/types/maintenance'
import { isMaintenanceBypassPath } from '~/utils/maintenance'

export default defineNuxtRouteMiddleware(async (to) => {
  const { isAdmin, profile, refreshProfile } = useAuth()
  const session = useSupabaseSession()

  if (session.value && !profile.value) {
    await refreshProfile()
  }

  let enabled = false
  try {
    const status = await $fetch<PublicMaintenanceStatus>('/api/maintenance')
    enabled = Boolean(status.enabled)
  }
  catch {
    // Fail open if the status endpoint is unavailable.
  }

  if (to.path === '/maintenance') {
    if (enabled || isAdmin.value) {
      return
    }
    return navigateTo('/')
  }

  if (!enabled || isAdmin.value || isMaintenanceBypassPath(to.path)) {
    return
  }

  return navigateTo('/maintenance')
})
