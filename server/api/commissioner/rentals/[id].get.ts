import { rentalIdentifierSchema } from '../../../../utils/rental-validation'
import { parseWithSchema } from '../../../../utils/validation'
import { defineApiHandler } from '../../../utils/api'
import { requireCommissionerClient } from '../../../utils/commissioner'
import { getOwnCommissionerRental } from '../../../services/commissioner.service'

export default defineApiHandler(async (event) => {
  const { client, profileId } = await requireCommissionerClient(event)
  const identifier = parseWithSchema(rentalIdentifierSchema, getRouterParam(event, 'id') || '')
  return getOwnCommissionerRental(client, profileId, identifier)
})
