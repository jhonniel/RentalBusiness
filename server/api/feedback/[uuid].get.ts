import { z } from 'zod'
import { parseWithSchema } from '../../../utils/validation'
import { getPublicFeedback } from '../../services/feedback.service'
import { defineApiHandler } from '../../utils/api'
import { AppError, ERROR_CODES } from '../../utils/errors'
import { assertRateLimit } from '../../utils/rate-limit'
import { getSupabaseAdminClient } from '../../utils/supabase'

const feedbackUuidSchema = z.string().uuid('This feedback link is invalid.')

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(`feedback-link:${ip}`, 40, 60_000)
  const uuid = parseWithSchema(feedbackUuidSchema, getRouterParam(event, 'uuid') || '')
  const token = String(getQuery(event).token || '')
  if (token.length < 20) {
    throw new AppError('This feedback link is invalid or has expired.', 404, ERROR_CODES.NOT_FOUND)
  }

  return getPublicFeedback(getSupabaseAdminClient(), uuid, token)
})
