import { z } from 'zod'
import { rentalIdentifierSchema } from '../../../../../../../utils/rental-validation'
import { parseWithSchema } from '../../../../../../../utils/validation'
import { defineApiHandler } from '../../../../../../utils/api'
import { assertRateLimit } from '../../../../../../utils/rate-limit'
import { requireAdminClient } from '../../../../../../utils/admin'
import { cancelAdminRentalExtension } from '../../../../../../services/admin-rental.service'

const bodySchema = z.object({
  reason: z.string().trim().max(500).optional().or(z.literal('')),
}).strict()

export default defineApiHandler(async (event) => {
  const { profile, client, profileId } = await requireAdminClient(event)
  assertRateLimit(`admin-rental:${profile.uuid}`, 40, 60_000)
  const identifier = parseWithSchema(rentalIdentifierSchema, getRouterParam(event, 'id') || '')
  const extensionUuid = parseWithSchema(z.string().uuid(), getRouterParam(event, 'uuid') || '')
  const input = parseWithSchema(bodySchema, (await readBody(event)) ?? {})
  return cancelAdminRentalExtension(event, client, profileId, identifier, extensionUuid, input)
})
