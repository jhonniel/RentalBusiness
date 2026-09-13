import { rentalIdentifierSchema } from '../../../utils/rental-validation'
import { parseWithSchema } from '../../../utils/validation'
import { defineApiHandler } from '../../utils/api'
import { getOwnRental } from '../../services/rental.service'
import { requireUserClient } from '../../utils/user'

export default defineApiHandler(async (event) => {
  const { client } = await requireUserClient(event)
  const identifier = parseWithSchema(rentalIdentifierSchema, getRouterParam(event, 'id') || '')
  return getOwnRental(client, identifier)
})
