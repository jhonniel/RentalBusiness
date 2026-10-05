import { rentalIdentifierSchema } from '../../../../../utils/rental-validation'
import { acceptAdminWaiverSchema } from '../../../../../utils/waiver-validation'
import { parseWithSchema } from '../../../../../utils/validation'
import { acceptAdminRentalWaiver } from '../../../../services/waiver.service'
import { requireAdminClient } from '../../../../utils/admin'
import { defineApiHandler } from '../../../../utils/api'
import { assertRateLimit } from '../../../../utils/rate-limit'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-rental-waiver:${profile.uuid}`, 20, 60_000)
  const identifier = parseWithSchema(rentalIdentifierSchema, getRouterParam(event, 'id') || '')
  const input = parseWithSchema(acceptAdminWaiverSchema, await readBody(event))
  return acceptAdminRentalWaiver(event, client, identifier, input)
})
