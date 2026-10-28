import { getFeedbackRewardSettings } from '../../../services/feedback.service'
import { requireAdminClient } from '../../../utils/admin'
import { defineApiHandler } from '../../../utils/api'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  return getFeedbackRewardSettings(client)
})
