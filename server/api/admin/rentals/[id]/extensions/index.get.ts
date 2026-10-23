import { rentalIdentifierSchema } from '../../../../../../utils/rental-validation'
import { parseWithSchema } from '../../../../../../utils/validation'
import { defineApiHandler } from '../../../../../utils/api'
import { requireAdminClient } from '../../../../../utils/admin'
import { listAdminRentalExtensions } from '../../../../../services/admin-rental.service'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  const identifier = parseWithSchema(rentalIdentifierSchema, getRouterParam(event, 'id') || '')
  return listAdminRentalExtensions(client, identifier)
})
