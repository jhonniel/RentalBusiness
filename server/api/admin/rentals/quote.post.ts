import { adminRentalQuoteSchema } from '../../../../utils/rental-validation'
import { parseWithSchema } from '../../../../utils/validation'
import { defineApiHandler } from '../../../utils/api'
import { assertRateLimit } from '../../../utils/rate-limit'
import { quoteRental } from '../../../services/rental.service'
import { assignedCommission } from '../../../services/commissioner.service'
import { expireUnconfirmedRentals } from '../../../services/cron.service'
import { requireAdminClient } from '../../../utils/admin'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-rental-quote:${profile.uuid}`, 40, 60_000)
  await expireUnconfirmedRentals(event).catch(() => undefined)
  const query = parseWithSchema(adminRentalQuoteSchema, await readBody(event))
  const quote = await quoteRental(client, query)
  if (!query.commissionerUuid) {
    return quote
  }

  const commission = await assignedCommission(client, query.commissionerUuid, {
    productUuid: quote.product.uuid,
    startsOn: quote.startsOn,
    endsOn: quote.endsOn,
    quantity: quote.quantity,
  })
  return {
    ...quote,
    commissionAmount: commission.commissionAmount,
  }
})
