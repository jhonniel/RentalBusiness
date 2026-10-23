import { rentalIdentifierSchema, rescheduleOwnRentalSchema } from '../../../../utils/rental-validation'
import { parseWithSchema } from '../../../../utils/validation'
import { defineApiHandler } from '../../../utils/api'
import { assertRateLimit } from '../../../utils/rate-limit'
import { rescheduleOwnRental } from '../../../services/rental.service'
import { requireUserClient } from '../../../utils/user'

export default defineApiHandler(async (event) => {
  const { profile, client, profileId } = await requireUserClient(event)
  assertRateLimit(`rental-schedule:${profile.uuid}`, 40, 60_000)
  const identifier = parseWithSchema(rentalIdentifierSchema, getRouterParam(event, 'id') || '')
  const input = parseWithSchema(rescheduleOwnRentalSchema, await readBody(event))
  return rescheduleOwnRental(event, client, profileId, identifier, input)
})
