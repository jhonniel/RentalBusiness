import { describe, expect, it } from 'vitest'
import { formatBytes, formatUptime, healthLabel, supabaseProjectRef, worstStatus } from '../../utils/system-health'

describe('system health helpers', () => {
  it('formats bytes and uptime', () => {
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(2048)).toBe('2 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5 MB')
    expect(formatUptime(90)).toBe('1m')
    expect(formatUptime(3700)).toBe('1h 1m')
  })

  it('reads the supabase project ref from the host', () => {
    expect(supabaseProjectRef('https://msmlarhbkhtkuripjpvl.supabase.co')).toEqual({
      host: 'msmlarhbkhtkuripjpvl.supabase.co',
      projectRef: 'msmlarhbkhtkuripjpvl',
    })
  })

  it('picks the worst status and labels', () => {
    expect(worstStatus(['ok', 'degraded', 'ok'])).toBe('degraded')
    expect(worstStatus(['ok', 'down'])).toBe('down')
    expect(healthLabel('ok')).toBe('Healthy')
  })
})
