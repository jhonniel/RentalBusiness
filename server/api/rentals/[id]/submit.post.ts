import { rentalIdentifierSchema } from '../../../../utils/rental-validation'
import { parseWithSchema } from '../../../../utils/validation'
import { defineApiHandler } from '../../../utils/api'
import { assertRateLimit } from '../../../utils/rate-limit'
import { submitOwnRental } from '../../../services/rental.service'
import { requireUserClient } from '../../../utils/user'

export default defineApiHandler(async (event) => {
  const { profile, client, profileId } = await requireUserClient(event)
  assertRateLimit(`rental-submit:${profile.uuid}`, 20, 60_000)
  const identifier = parseWithSchema(rentalIdentifierSchema, getRouterParam(event, 'id') || '')
  return submitOwnRental(event, client, profileId, identifier)
})
