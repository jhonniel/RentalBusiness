import { isDevicePublicCode, normalizeDevicePublicCode } from '../../../utils/registered-device'
import { defineApiHandler } from '../../utils/api'
import { assertRateLimit } from '../../utils/rate-limit'
import { AppError, ERROR_CODES } from '../../utils/errors'
import { getPublicRegisteredDevice } from '../../services/registered-device.service'

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(`public-devices:${ip}`, 60, 60_000)
  const code = normalizeDevicePublicCode(getRouterParam(event, 'code') || '')
  if (!isDevicePublicCode(code)) {
    throw new AppError('Device not found.', 404, ERROR_CODES.NOT_FOUND)
  }
  return getPublicRegisteredDevice(code)
})
