import { z } from 'zod'
import { parseWithSchema } from '../../../../../utils/validation'
import { defineApiHandler } from '../../../../utils/api'
import { assertRateLimit } from '../../../../utils/rate-limit'
import { requireAdminClient } from '../../../../utils/admin'
import { deleteAdminProfile } from '../../../../services/customer.service'

export default defineApiHandler(async (event) => {
  const { profile, client, profileId } = await requireAdminClient(event)
  assertRateLimit(`admin-profile-delete:${profile.uuid}`, 20, 60_000)
  const uuid = parseWithSchema(z.string().uuid(), getRouterParam(event, 'uuid') || '')
  return deleteAdminProfile(event, client, { uuid: profile.uuid, profileId }, uuid)
})
