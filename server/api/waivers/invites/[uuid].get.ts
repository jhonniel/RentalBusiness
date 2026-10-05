import { z } from 'zod'
import { parseWithSchema } from '../../../../utils/validation'
import { getPublicWaiverInvite } from '../../../services/waiver.service'
import { defineApiHandler } from '../../../utils/api'
import { AppError, ERROR_CODES } from '../../../utils/errors'
import { assertRateLimit } from '../../../utils/rate-limit'
import { getSupabaseAdminClient } from '../../../utils/supabase'

const inviteUuidSchema = z.string().uuid('This sign link is invalid.')

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(`waiver-invite:${ip}`, 40, 60_000)
  const uuid = parseWithSchema(inviteUuidSchema, getRouterParam(event, 'uuid') || '')
  const token = String(getQuery(event).token || '')
  if (token.length < 20) {
    throw new AppError('This sign link is invalid or has expired.', 404, ERROR_CODES.NOT_FOUND)
  }

  return getPublicWaiverInvite(getSupabaseAdminClient(), uuid, token)
})
