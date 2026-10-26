import { faqInputSchema } from '../../../../utils/faq-validation'
import { parseWithSchema } from '../../../../utils/validation'
import { requireAdminClient } from '../../../utils/admin'
import { defineApiHandler } from '../../../utils/api'
import { AppError, ERROR_CODES } from '../../../utils/errors'
import { assertRateLimit } from '../../../utils/rate-limit'
import { saveFaq } from '../../../services/faq.service'

export default defineApiHandler(async (event) => {
  const uuid = getRouterParam(event, 'uuid')
  if (!uuid) {
    throw new AppError('FAQ not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-faqs:${profile.uuid}`, 40, 60_000)
  const input = parseWithSchema(faqInputSchema, await readBody(event))
  return saveFaq(event, client, input, uuid)
})
