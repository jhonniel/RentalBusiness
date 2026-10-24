import { markAdminPaidSchema } from '../../../../../../utils/payment-validation'
import { rentalIdentifierSchema } from '../../../../../../utils/rental-validation'
import { parseWithSchema } from '../../../../../../utils/validation'
import { defineApiHandler } from '../../../../../utils/api'
import { assertRateLimit } from '../../../../../utils/rate-limit'
import { requireAdminClient } from '../../../../../utils/admin'
import { markAdminLateFeePaid } from '../../../../../services/late-fee.service'

export default defineApiHandler(async (event) => {
  const { profile, client, profileId } = await requireAdminClient(event)
  assertRateLimit(`admin-rental:${profile.uuid}`, 40, 60_000)
  const identifier = parseWithSchema(rentalIdentifierSchema, getRouterParam(event, 'id') || '')
  const input = parseWithSchema(markAdminPaidSchema, (await readBody(event)) ?? {})
  return markAdminLateFeePaid(event, client, profileId, identifier, input)
})
