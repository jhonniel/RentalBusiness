import { adminRentalListQuerySchema } from '../../../utils/admin-validation'
import { parseWithSchema } from '../../../utils/validation'
import { defineApiHandler } from '../../utils/api'
import { requireAdminClient } from '../../utils/admin'
import { listAdminRentals } from '../../services/admin-rental.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  const query = parseWithSchema(adminRentalListQuerySchema, getQuery(event))
  return listAdminRentals(client, query)
})
