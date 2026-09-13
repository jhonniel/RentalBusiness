import { paymentIdentifierSchema } from '../../../../utils/payment-validation'
import { parseWithSchema } from '../../../../utils/validation'
import { defineApiHandler } from '../../../utils/api'
import { assertRateLimit } from '../../../utils/rate-limit'
import { verifyOwnPayment } from '../../../services/payment.service'
import { requireUserClient } from '../../../utils/user'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireUserClient(event)
  assertRateLimit(`payment-verify:${profile.uuid}`, 20, 60_000)
  const uuid = parseWithSchema(paymentIdentifierSchema, getRouterParam(event, 'id') || '')
  return verifyOwnPayment(event, client, uuid)
})
