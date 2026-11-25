import { assignDeviceSchema } from '../../../../../utils/registered-device-validation'
import { parseWithSchema } from '../../../../../utils/validation'
import { requireAdminClient } from '../../../../utils/admin'
import { defineApiHandler } from '../../../../utils/api'
import { assertRateLimit } from '../../../../utils/rate-limit'
import { AppError, ERROR_CODES } from '../../../../utils/errors'
import { assignRegisteredDevice } from '../../../../services/registered-device.service'

export default defineApiHandler(async (event) => {
  const { profile, client } = await requireAdminClient(event)
  assertRateLimit(`admin-devices-assign:${profile.uuid}`, 40, 60_000)
  const uuid = getRouterParam(event, 'uuid')
  if (!uuid) {
    throw new AppError('Device not found.', 404, ERROR_CODES.NOT_FOUND)
  }
  const input = parseWithSchema(assignDeviceSchema, await readBody(event))
  return assignRegisteredDevice(event, client, uuid, input)
})
