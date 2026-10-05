import { rentalIdentifierSchema } from '../../../../../utils/rental-validation'
import { parseWithSchema } from '../../../../../utils/validation'
import { submitAdminRentalIdentity } from '../../../../services/identity.service'
import { requireAdminClient } from '../../../../utils/admin'
import { defineApiHandler } from '../../../../utils/api'
import { AppError, ERROR_CODES } from '../../../../utils/errors'
import { assertRateLimit } from '../../../../utils/rate-limit'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-rental-identity:${profile.uuid}`, 12, 60_000)
  const identifier = parseWithSchema(rentalIdentifierSchema, getRouterParam(event, 'id') || '')
  const form = await readMultipartFormData(event)
  const governmentId = form?.find(part => part.name === 'governmentId' && part.data)
  const selfie = form?.find(part => part.name === 'selfie' && part.data)

  if (!governmentId || !selfie) {
    throw new AppError('Upload a government ID and a selfie holding that same ID.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  return submitAdminRentalIdentity(event, client, identifier, {
    governmentId,
    selfie,
  })
})
