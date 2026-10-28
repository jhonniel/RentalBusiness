import { feedbackRewardSettingsSchema } from '../../../../utils/feedback-reward'
import { parseWithSchema } from '../../../../utils/validation'
import { saveFeedbackRewardSettings } from '../../../services/feedback.service'
import { requireAdminClient } from '../../../utils/admin'
import { defineApiHandler } from '../../../utils/api'
import { assertRateLimit } from '../../../utils/rate-limit'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-feedback-reward:${profile.uuid}`, 20, 60_000)
  const input = parseWithSchema(feedbackRewardSettingsSchema, await readBody(event))
  return saveFeedbackRewardSettings(event, client, input)
})
