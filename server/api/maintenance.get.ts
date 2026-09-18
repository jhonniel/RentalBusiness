import { defineApiHandler } from '../utils/api'
import { getPublicSupabaseClient, isSupabaseConfigured } from '../utils/supabase'
import { getPublicMaintenanceSafe } from '../services/maintenance.service'

export default defineApiHandler(async (event) => {
  if (!isSupabaseConfigured()) {
    return getPublicMaintenanceSafe()
  }

  try {
    const client = await getPublicSupabaseClient(event)
    return await getPublicMaintenanceSafe(client)
  }
  catch {
    return getPublicMaintenanceSafe()
  }
})
