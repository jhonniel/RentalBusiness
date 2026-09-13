import { defineApiHandler } from '../../../utils/api'
import { AppError, ERROR_CODES } from '../../../utils/errors'
import { assertRateLimit } from '../../../utils/rate-limit'
import { submitRentalIdentity } from '../../../services/identity.service'
import { requireUserClient } from '../../../utils/user'

export default defineApiHandler(async (event) => {
  const identifier = getRouterParam(event, 'id')
  if (!identifier) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const { user, profile, client, profileId } = await requireUserClient(event)
  assertRateLimit(`rental-identity:${profile.uuid}`, 12, 60_000)

  const form = await readMultipartFormData(event)
  const governmentId = form?.find(part => part.name === 'governmentId' && part.data)
  const selfie = form?.find(part => part.name === 'selfie' && part.data)

  return submitRentalIdentity(event, client, profileId, user.sub, identifier, {
    governmentId,
    selfie,
  })
})
