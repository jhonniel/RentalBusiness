import { defineApiHandler } from '../../utils/api'
import { requireAdminClient } from '../../utils/admin'
import { getAdminAnalytics } from '../../services/analytics.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  return getAdminAnalytics(client)
})
