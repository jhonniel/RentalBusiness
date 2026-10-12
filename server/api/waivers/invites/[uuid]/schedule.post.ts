import { z } from 'zod'
import { updateWaiverInviteScheduleSchema } from '../../../../../utils/rental-validation'
import { parseWithSchema } from '../../../../../utils/validation'
import { updateWaiverInviteSchedule } from '../../../../services/waiver.service'
import { defineApiHandler } from '../../../../utils/api'
import { assertRateLimit } from '../../../../utils/rate-limit'
import { getSupabaseAdminClient } from '../../../../utils/supabase'

const inviteUuidSchema = z.string().uuid('This sign link is invalid.')

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(`waiver-invite-schedule:${ip}`, 20, 60_000)
  const uuid = parseWithSchema(inviteUuidSchema, getRouterParam(event, 'uuid') || '')
  const input = parseWithSchema(updateWaiverInviteScheduleSchema, await readBody(event))
  return updateWaiverInviteSchedule(event, getSupabaseAdminClient(), uuid, input)
})
