import { adminFeedbackListQuerySchema } from '../../../utils/feedback-validation'
import { parseWithSchema } from '../../../utils/validation'
import { listAdminFeedback } from '../../services/feedback.service'
import { requireAdminClient } from '../../utils/admin'
import { defineApiHandler } from '../../utils/api'

export default defineApiHandler(async (event) => {
  const { client } = await requireAdminClient(event)
  const query = parseWithSchema(adminFeedbackListQuerySchema, getQuery(event))
  return listAdminFeedback(client, query)
})
