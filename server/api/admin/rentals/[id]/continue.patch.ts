import { continueAdminRentalSchema, rentalIdentifierSchema } from '../../../../../utils/rental-validation'
import { parseWithSchema } from '../../../../../utils/validation'
import { continueAdminRental } from '../../../../services/admin-rental.service'
import { requireAdminClient } from '../../../../utils/admin'
import { defineApiHandler } from '../../../../utils/api'
import { assertRateLimit } from '../../../../utils/rate-limit'

export default defineApiHandler(async (event) => {
  const { profile, client, profileId } = await requireAdminClient(event)
  assertRateLimit(`admin-rental:${profile.uuid}`, 40, 60_000)
  const identifier = parseWithSchema(rentalIdentifierSchema, getRouterParam(event, 'id') || '')
  const input = parseWithSchema(continueAdminRentalSchema, await readBody(event))
  return continueAdminRental(event, client, profileId, identifier, input)
})
