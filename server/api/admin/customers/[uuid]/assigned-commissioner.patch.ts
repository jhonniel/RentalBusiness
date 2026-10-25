import { linkCustomerCommissionerSchema, profileUuidSchema } from '../../../../../utils/admin-validation'
import { parseWithSchema } from '../../../../../utils/validation'
import { linkCustomerCommissioner } from '../../../../services/customer.service'
import { requireAdminClient } from '../../../../utils/admin'
import { defineApiHandler } from '../../../../utils/api'
import { assertRateLimit } from '../../../../utils/rate-limit'

export default defineApiHandler(async (event) => {
  const { profile, client, profileId } = await requireAdminClient(event)
  assertRateLimit(`admin-customers:${profile.uuid}`, 40, 60_000)
  const uuid = parseWithSchema(profileUuidSchema, getRouterParam(event, 'uuid') || '')
  const input = parseWithSchema(linkCustomerCommissionerSchema, await readBody(event))
  return linkCustomerCommissioner(event, client, profileId, uuid, input.commissionerUuid)
})
