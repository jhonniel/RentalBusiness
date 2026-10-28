import { rentalIdentifierSchema } from '../../../../../utils/rental-validation'
import { parseWithSchema } from '../../../../../utils/validation'
import { getAdminRentalFeedback } from '../../../../services/feedback.service'
import { requireAdminClient } from '../../../../utils/admin'
import { defineApiHandler } from '../../../../utils/api'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  const identifier = parseWithSchema(rentalIdentifierSchema, getRouterParam(event, 'id') || '')
  return getAdminRentalFeedback(client, identifier)
})
