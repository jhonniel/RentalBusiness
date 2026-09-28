import { defineApiHandler } from '../../utils/api'
import { requireAdminClient } from '../../utils/admin'
import { listAdminSystemUsers } from '../../services/customer.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  return listAdminSystemUsers(client)
})
