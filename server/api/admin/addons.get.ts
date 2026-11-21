import { requireAdminClient } from '../../utils/admin'
import { defineApiHandler } from '../../utils/api'
import { getAdminAddons } from '../../services/addon.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  return getAdminAddons(client)
})
