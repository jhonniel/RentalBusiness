import { defineApiHandler } from '../../utils/api'
import { requireAdminClient } from '../../utils/admin'
import { getAdminMaintenance } from '../../services/maintenance.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  return getAdminMaintenance(client)
})
