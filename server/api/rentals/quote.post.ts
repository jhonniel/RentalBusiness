import { rentalQuoteQuerySchema } from '../../../utils/rental-validation'
import { parseWithSchema } from '../../../utils/validation'
import { defineApiHandler } from '../../utils/api'
import { assertRateLimit } from '../../utils/rate-limit'
import { quoteRental } from '../../services/rental.service'
import { expireUnconfirmedRentals } from '../../services/cron.service'
import { requireUserClient } from '../../utils/user'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireUserClient(event)
  assertRateLimit(`rental-quote:${profile.uuid}`, 40, 60_000)
  await expireUnconfirmedRentals(event).catch(() => undefined)
  const query = parseWithSchema(rentalQuoteQuerySchema, await readBody(event))
  return quoteRental(client, query)
})
