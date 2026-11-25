import { requireAdminClient } from '../../../../utils/admin'
import { defineApiHandler } from '../../../../utils/api'
import { assertRateLimit } from '../../../../utils/rate-limit'
import { AppError, ERROR_CODES } from '../../../../utils/errors'
import { releaseRegisteredDevice } from '../../../../services/registered-device.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-devices-release:${profile.uuid}`, 40, 60_000)
  const uuid = getRouterParam(event, 'uuid')
  if (!uuid) {
    throw new AppError('Device not found.', 404, ERROR_CODES.NOT_FOUND)
  }
  return releaseRegisteredDevice(event, client, uuid)
})
