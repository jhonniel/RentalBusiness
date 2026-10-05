import { z } from 'zod'
import { acceptWaiverInviteSchema } from '../../../../../utils/waiver-validation'
import { parseWithSchema } from '../../../../../utils/validation'
import { acceptWaiverInvite } from '../../../../services/waiver.service'
import { defineApiHandler } from '../../../../utils/api'
import { assertRateLimit } from '../../../../utils/rate-limit'
import { getSupabaseAdminClient } from '../../../../utils/supabase'

const inviteUuidSchema = z.string().uuid('This sign link is invalid.')

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(`waiver-invite-accept:${ip}`, 20, 60_000)
  const uuid = parseWithSchema(inviteUuidSchema, getRouterParam(event, 'uuid') || '')
  const input = parseWithSchema(acceptWaiverInviteSchema, await readBody(event))
  return acceptWaiverInvite(event, getSupabaseAdminClient(), uuid, input)
})
