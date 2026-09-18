import { ERROR_CODES } from '../utils/errors'
import { isMaintenanceBypassApiPath } from '../../utils/maintenance'
import { getCurrentProfile } from '../utils/auth'
import { isSiteInMaintenance } from '../services/maintenance.service'

export default defineEventHandler(async (event) => {
  const path = event.path || ''
  if (!path.startsWith('/api/') || isMaintenanceBypassApiPath(path)) {
    return
  }

  const enabled = await isSiteInMaintenance()
  if (!enabled) {
    return
  }

  try {
    const profile = await getCurrentProfile(event)
    if (profile.role === 'admin') {
      return
    }
  }
  catch {
    // Visitors and customers cannot use storefront APIs during maintenance.
  }

  throw createError({
    statusCode: 503,
    statusMessage: 'The website is under maintenance.',
    data: {
      code: ERROR_CODES.MAINTENANCE,
      message: 'The website is under maintenance.',
    },
  })
})
