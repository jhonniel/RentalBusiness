import { z } from 'zod'
import { completeWaiverInviteContactSchema } from '../../../../../utils/waiver-validation'
import { parseWithSchema } from '../../../../../utils/validation'
import { completeWaiverInviteContact } from '../../../../services/waiver.service'
import { defineApiHandler } from '../../../../utils/api'
import { assertRateLimit } from '../../../../utils/rate-limit'
import { getSupabaseAdminClient } from '../../../../utils/supabase'

const inviteUuidSchema = z.string().uuid('This sign link is invalid.')

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(`waiver-invite-contact:${ip}`, 20, 60_000)
  const uuid = parseWithSchema(inviteUuidSchema, getRouterParam(event, 'uuid') || '')
  const input = parseWithSchema(completeWaiverInviteContactSchema, await readBody(event))
  return completeWaiverInviteContact(getSupabaseAdminClient(), uuid, input)
})
