import { rentalIdentifierSchema } from '../../../../../utils/rental-validation'
import { sendWaiverInviteSchema } from '../../../../../utils/waiver-validation'
import { parseWithSchema } from '../../../../../utils/validation'
import { sendAdminWaiverInvite } from '../../../../services/waiver.service'
import { requireAdminClient } from '../../../../utils/admin'
import { defineApiHandler } from '../../../../utils/api'
import { assertRateLimit } from '../../../../utils/rate-limit'

export default defineApiHandler(async (event) => {
  const { profile, client, profileId } = await requireAdminClient(event)
  assertRateLimit(`admin-waiver-invite:${profile.uuid}`, 20, 60_000)
  const identifier = parseWithSchema(rentalIdentifierSchema, getRouterParam(event, 'id') || '')
  const input = parseWithSchema(sendWaiverInviteSchema, await readBody(event).catch(() => ({})))
  return sendAdminWaiverInvite(event, client, profileId, identifier, input)
})
