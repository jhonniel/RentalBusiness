import { adminCalendarFindQuerySchema } from '../../../../utils/admin-validation'
import { parseWithSchema } from '../../../../utils/validation'
import { defineApiHandler } from '../../../utils/api'
import { requireAdminClient } from '../../../utils/admin'
import { findAdminCalendarRentals } from '../../../services/admin-rental.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  const query = parseWithSchema(adminCalendarFindQuerySchema, getQuery(event))
  return findAdminCalendarRentals(client, query.code)
})
