import { createPaymentSchema } from '../../../utils/payment-validation'
import { parseWithSchema } from '../../../utils/validation'
import { defineApiHandler } from '../../utils/api'
import { assertRateLimit } from '../../utils/rate-limit'
import { createPayment } from '../../services/payment.service'
import { requireUserClient } from '../../utils/user'

export default defineApiHandler(async (event) => {
  const { profile, client, profileId } = await requireUserClient(event)
  assertRateLimit(`payment-create:${profile.uuid}`, 20, 60_000)
  const input = parseWithSchema(createPaymentSchema, await readBody(event))
  return createPayment(event, client, profileId, input)
})
