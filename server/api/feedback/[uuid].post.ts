import { z } from 'zod'
import { submitFeedbackSchema } from '../../../utils/feedback-validation'
import { parseWithSchema } from '../../../utils/validation'
import { submitPublicFeedback } from '../../services/feedback.service'
import { defineApiHandler } from '../../utils/api'
import { assertRateLimit } from '../../utils/rate-limit'
import { getSupabaseAdminClient } from '../../utils/supabase'

const feedbackUuidSchema = z.string().uuid('This feedback link is invalid.')

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(`feedback-submit:${ip}`, 10, 60_000)
  const uuid = parseWithSchema(feedbackUuidSchema, getRouterParam(event, 'uuid') || '')
  const input = parseWithSchema(submitFeedbackSchema, await readBody(event))
  return submitPublicFeedback(event, getSupabaseAdminClient(), uuid, input)
})
