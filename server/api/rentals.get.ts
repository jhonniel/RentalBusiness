import { rentalListQuerySchema } from '../../utils/rental-validation'
import { parseWithSchema } from '../../utils/validation'
import { defineApiHandler } from '../utils/api'
import { assertRateLimit } from '../utils/rate-limit'
import { listOwnRentals } from '../services/rental.service'
import { requireUserClient } from '../utils/user'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireUserClient(event)
  assertRateLimit(`rental-list:${profile.uuid}`, 60, 60_000)
  const query = parseWithSchema(rentalListQuerySchema, getQuery(event))
  return listOwnRentals(client, query)
})
