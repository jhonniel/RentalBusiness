import { rentalQuoteQuerySchema } from '../../../../utils/rental-validation'
import { parseWithSchema } from '../../../../utils/validation'
import { defineApiHandler } from '../../../utils/api'
import { assertRateLimit } from '../../../utils/rate-limit'
import { quoteCommissionerRental } from '../../../services/commissioner.service'
import { requireCommissionerClient } from '../../../utils/commissioner'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireCommissionerClient(event)
  assertRateLimit(`commissioner-quote:${profile.uuid}`, 40, 60_000)
  const query = parseWithSchema(rentalQuoteQuerySchema, await readBody(event))
  const quote = await quoteCommissionerRental(client, query)
  const { productId: _productId, hasBlockedDates: _hasBlockedDates, ...publicQuote } = quote
  return publicQuote
})
