import type { H3Event } from 'h3'
import { cronSecretMatches, extractCronSecret } from '../../utils/cron'
import { isUsableSecret } from '../../utils/env'
import { AppError, ERROR_CODES } from './errors'

export function requireCronSecret(event: H3Event) {
  const config = useRuntimeConfig()
  const expected = String(config.cronSecret || process.env.CRON_SECRET || process.env.NUXT_CRON_SECRET || '')

  if (!isUsableSecret(expected)) {
    throw new AppError(
      'Scheduled jobs are not configured.',
      503,
      ERROR_CODES.INTERNAL_ERROR,
    )
  }

  const provided = extractCronSecret(
    getHeader(event, 'authorization'),
    getHeader(event, 'x-cron-secret'),
  )

  if (!cronSecretMatches(expected, provided)) {
    throw new AppError('Unauthorized.', 401, ERROR_CODES.UNAUTHORIZED)
  }
}
