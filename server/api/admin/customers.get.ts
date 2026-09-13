import { adminCustomerListQuerySchema } from '../../../utils/admin-validation'
import { parseWithSchema } from '../../../utils/validation'
import { defineApiHandler } from '../../utils/api'
import { requireAdminClient } from '../../utils/admin'
import { listAdminCustomers } from '../../services/customer.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  const query = parseWithSchema(adminCustomerListQuerySchema, getQuery(event))
  return listAdminCustomers(client, query)
})
