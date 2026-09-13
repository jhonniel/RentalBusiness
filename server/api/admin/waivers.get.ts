import { defineApiHandler } from '../../utils/api'
import { requireAdminClient } from '../../utils/admin'
import { listAdminWaivers } from '../../services/waiver.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  return listAdminWaivers(client)
})
