import { sandboxCompleteSchema } from '../../../../utils/payment-validation'
import { parseWithSchema } from '../../../../utils/validation'
import { defineApiHandler } from '../../../utils/api'
import { assertRateLimit } from '../../../utils/rate-limit'
import { completeSandboxPayment } from '../../../services/payment.service'
import { requireUserClient } from '../../../utils/user'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireUserClient(event)
  assertRateLimit(`payment-sandbox:${profile.uuid}`, 20, 60_000)
  const input = parseWithSchema(sandboxCompleteSchema, await readBody(event))
  return completeSandboxPayment(event, client, input)
})
