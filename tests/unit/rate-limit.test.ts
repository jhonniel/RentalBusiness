import { describe, expect, it } from 'vitest'
import { AppError } from '../../utils/errors'
import { assertRateLimit } from '../../server/utils/rate-limit'

describe('assertRateLimit', () => {
  it('allows requests under the limit and blocks extras', () => {
    const key = `test-${Date.now()}`

    assertRateLimit(key, 2, 60_000)
    assertRateLimit(key, 2, 60_000)

    expect(() => assertRateLimit(key, 2, 60_000)).toThrow(AppError)
  })
})
