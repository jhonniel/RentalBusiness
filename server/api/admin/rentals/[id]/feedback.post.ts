import { sendFeedbackLinkSchema } from '../../../../../utils/feedback-validation'
import { rentalIdentifierSchema } from '../../../../../utils/rental-validation'
import { parseWithSchema } from '../../../../../utils/validation'
import { sendFeedbackLink } from '../../../../services/feedback.service'
import { requireAdminClient } from '../../../../utils/admin'
import { defineApiHandler } from '../../../../utils/api'
import { assertRateLimit } from '../../../../utils/rate-limit'

export default defineApiHandler(async (event) => {
  const { profile, client, profileId } = await requireAdminClient(event)
  assertRateLimit(`admin-feedback-link:${profile.uuid}`, 20, 60_000)
  const identifier = parseWithSchema(rentalIdentifierSchema, getRouterParam(event, 'id') || '')
  const input = parseWithSchema(sendFeedbackLinkSchema, await readBody(event).catch(() => ({})))
  return sendFeedbackLink(event, client, profileId, identifier, input)
})
