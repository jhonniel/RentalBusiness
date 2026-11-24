import { isSocialPageCode, normalizeSocialPageCode } from '../../../utils/social-link'
import { defineApiHandler } from '../../utils/api'
import { assertRateLimit } from '../../utils/rate-limit'
import { AppError, ERROR_CODES } from '../../utils/errors'
import { getPublicSocialPage } from '../../services/social-link.service'

export default defineApiHandler(async (event) => {
  const ip = getRequestIP(event, { xForwardedFor: true }) || 'unknown'
  assertRateLimit(`public-social-links:${ip}`, 60, 60_000)
  const code = normalizeSocialPageCode(getRouterParam(event, 'code') || '')
  if (!isSocialPageCode(code)) {
    throw new AppError('Links page not found.', 404, ERROR_CODES.NOT_FOUND)
  }
  return getPublicSocialPage(code)
})
