import { paymentMethodInputSchema } from '../../../utils/payment-method-validation'
import { parseWithSchema } from '../../../utils/validation'
import { requireAdminClient } from '../../utils/admin'
import { defineApiHandler } from '../../utils/api'
import { assertRateLimit } from '../../utils/rate-limit'
import { savePaymentMethod } from '../../services/payment-method.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-payment-methods:${profile.uuid}`, 40, 60_000)
  const input = parseWithSchema(paymentMethodInputSchema, await readBody(event))
  return savePaymentMethod(event, client, input)
})
