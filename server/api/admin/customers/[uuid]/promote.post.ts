import { profileUuidSchema } from '../../../../../utils/admin-validation'
import { parseWithSchema } from '../../../../../utils/validation'
import { promoteAdminCustomer } from '../../../../services/customer.service'
import { requireAdminClient } from '../../../../utils/admin'
import { defineApiHandler } from '../../../../utils/api'
import { assertRateLimit } from '../../../../utils/rate-limit'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-customers:${profile.uuid}`, 20, 60_000)
  const uuid = parseWithSchema(profileUuidSchema, getRouterParam(event, 'uuid') || '')
  return promoteAdminCustomer(event, client, profile.uuid, uuid)
})
