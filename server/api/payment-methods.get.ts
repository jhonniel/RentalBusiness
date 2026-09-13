import { defineApiHandler } from '../utils/api'
import { assertRateLimit } from '../utils/rate-limit'
import { requireUserClient } from '../utils/user'
import { getActivePaymentMethods } from '../services/payment-method.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireUserClient(event)
  assertRateLimit(`payment-methods:${profile.uuid}`, 80, 60_000)
  return getActivePaymentMethods(client)
})
