import { faqInputSchema } from '../../../utils/faq-validation'
import { parseWithSchema } from '../../../utils/validation'
import { requireAdminClient } from '../../utils/admin'
import { defineApiHandler } from '../../utils/api'
import { assertRateLimit } from '../../utils/rate-limit'
import { saveFaq } from '../../services/faq.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-faqs:${profile.uuid}`, 40, 60_000)
  const input = parseWithSchema(faqInputSchema, await readBody(event))
  return saveFaq(event, client, input)
})
