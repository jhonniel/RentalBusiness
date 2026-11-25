import { unlockDeviceSchema } from '../../../../utils/registered-device-validation'
import { isDevicePublicCode, normalizeDevicePublicCode } from '../../../../utils/registered-device'
import { parseWithSchema } from '../../../../utils/validation'
import { defineApiHandler } from '../../../utils/api'
import { assertRateLimit } from '../../../utils/rate-limit'
import { AppError, ERROR_CODES } from '../../../utils/errors'
import { unlockPublicRegisteredDevice } from '../../../services/registered-device.service'

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(`public-devices-unlock:${ip}`, 10, 60_000)
  const code = normalizeDevicePublicCode(getRouterParam(event, 'code') || '')
  if (!isDevicePublicCode(code)) {
    throw new AppError('Device not found.', 404, ERROR_CODES.NOT_FOUND)
  }
  const input = parseWithSchema(unlockDeviceSchema, await readBody(event))
  return unlockPublicRegisteredDevice(code, {
    rentalCode: input.rentalCode.trim().toUpperCase(),
  })
})
