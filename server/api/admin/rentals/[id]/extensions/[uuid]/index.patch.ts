import { z } from 'zod'
import { editAdminRentalExtensionSchema, rentalIdentifierSchema } from '../../../../../../../utils/rental-validation'
import { parseWithSchema } from '../../../../../../../utils/validation'
import { defineApiHandler } from '../../../../../../utils/api'
import { assertRateLimit } from '../../../../../../utils/rate-limit'
import { requireAdminClient } from '../../../../../../utils/admin'
import { editAdminRentalExtension } from '../../../../../../services/admin-rental.service'

export default defineApiHandler(async (event) => {
  const { profile, client, profileId } = await requireAdminClient(event)
  assertRateLimit(`admin-rental:${profile.uuid}`, 40, 60_000)
  const identifier = parseWithSchema(rentalIdentifierSchema, getRouterParam(event, 'id') || '')
  const extensionUuid = parseWithSchema(z.string().uuid(), getRouterParam(event, 'uuid') || '')
  const input = parseWithSchema(editAdminRentalExtensionSchema, (await readBody(event)) ?? {})
  return editAdminRentalExtension(event, client, profileId, identifier, extensionUuid, input)
})
