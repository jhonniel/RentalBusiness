import { createRentalSchema } from '../../utils/rental-validation'
import { parseWithSchema } from '../../utils/validation'
import { defineApiHandler } from '../utils/api'
import { assertRateLimit } from '../utils/rate-limit'
import { createRental } from '../services/rental.service'
import { requireUserClient } from '../utils/user'

export default defineApiHandler(async (event) => {
  const { user, profile, client, profileId } = await requireUserClient(event)
  assertRateLimit(`rental-create:${profile.uuid}`, 20, 60_000)
  const input = parseWithSchema(createRentalSchema, await readBody(event))
  return createRental(event, client, { userId: user.sub, profileId }, input)
})
