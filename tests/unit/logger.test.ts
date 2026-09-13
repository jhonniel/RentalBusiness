import { describe, expect, it, vi } from 'vitest'
import { logger } from '../../server/utils/logger'

describe('logger', () => {
  it('redacts secret-like keys', () => {
    const spy = vi.spyOn(console, 'info').mockImplementation(() => {})

    logger.info('boot', {
      supabaseServiceRoleKey: 'super-secret',
      rawBody: '{"signature":"abc"}',
      html: '<p>secret receipt</p>',
      requestId: 'req-1',
    })

    const payload = JSON.parse(String(spy.mock.calls[0]?.[0]))
    expect(payload.supabaseServiceRoleKey).toBe('[redacted]')
    expect(payload.rawBody).toBe('[redacted]')
    expect(payload.html).toBe('[redacted]')
    expect(payload.requestId).toBe('req-1')
    spy.mockRestore()
  })
})
