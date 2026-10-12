import { createAdminRentalSchema } from '../../../utils/rental-validation'
import { parseWithSchema } from '../../../utils/validation'
import { createAdminRental } from '../../services/admin-rental.service'
import { requireAdminClient } from '../../utils/admin'
import { defineApiHandler } from '../../utils/api'
import { assertRateLimit } from '../../utils/rate-limit'

export default defineApiHandler(async (event) => {
  const { profile, client, profileId } = await requireAdminClient(event)
  assertRateLimit(`admin-rental-create:${profile.uuid}`, 20, 60_000)
  const input = parseWithSchema(createAdminRentalSchema, await readBody(event))
  return createAdminRental(event, client, profileId, input)
})
