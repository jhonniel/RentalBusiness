import { defineApiHandler } from '../../utils/api'
import { requireAdminClient } from '../../utils/admin'
import { getAdminSettings } from '../../services/settings.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  return getAdminSettings(client)
})
