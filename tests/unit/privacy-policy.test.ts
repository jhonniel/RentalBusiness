import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CURRENT_PRIVACY_POLICY_META, CURRENT_PRIVACY_POLICY_VERSION } from '../../utils/privacy-policy'

describe('privacy policy', () => {
  it('publishes a versioned RA 10173 policy without bundling marketing or the waiver', () => {
    const source = readFileSync(resolve(process.cwd(), 'supabase/privacy-jry-v1.txt'), 'utf8')

    expect(CURRENT_PRIVACY_POLICY_VERSION).toBe('JRY-PRIVACY-v1.0')
    expect(CURRENT_PRIVACY_POLICY_META.version).toBe('JRY-PRIVACY-v1.0')
    expect(source).toContain('Data Privacy Act of 2012')
    expect(source).toContain('National Privacy Commission')
    expect(source).toContain('does not sell your personal information')
    expect(source).toContain(CURRENT_PRIVACY_POLICY_VERSION)
    expect(source).toContain('promotional communications only if permitted')
  })
})
