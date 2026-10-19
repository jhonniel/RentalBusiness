import { defineApiHandler } from '../../../utils/api'
import { requireAdminClient } from '../../../utils/admin'
import { listAdminCommissions } from '../../../services/commission.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  return listAdminCommissions(client)
})
