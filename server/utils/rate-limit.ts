import { AppError, ERROR_CODES } from './errors'

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

export function assertRateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now()
  const current = buckets.get(key)

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  if (current.count >= limit) {
    throw new AppError(
      'Too many attempts. Please wait and try again.',
      429,
      ERROR_CODES.VALIDATION_ERROR,
    )
  }

  current.count += 1
}
