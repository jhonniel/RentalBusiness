import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CURRENT_COOKIE_POLICY_META, CURRENT_COOKIE_POLICY_VERSION } from '../../utils/constants'

describe('cookie policy', () => {
  it('publishes a versioned cookie policy without advertising cookies', () => {
    const source = readFileSync(resolve(process.cwd(), 'supabase/cookies-jry-v1.txt'), 'utf8')

    expect(CURRENT_COOKIE_POLICY_VERSION).toBe('JRY-COOKIE-v1.0')
    expect(CURRENT_COOKIE_POLICY_META.title).toBe('Cookie Policy')
    expect(source).toContain(CURRENT_COOKIE_POLICY_VERSION)
    expect(source).toContain('Data Privacy Act of 2012')
    expect(source).toContain('Strictly necessary')
    expect(source).toContain('do not currently set advertising cookies')
    expect(source).not.toContain('[INSERT YOUR ACTUAL POLICY HERE]')
  })

  it('bundles the Cookie Policy file with other legal documents', () => {
    const config = readFileSync(resolve(process.cwd(), 'nuxt.config.ts'), 'utf8')
    expect(config).toContain('resolvePath(rootDir, \'supabase\')')
    expect(config).toContain('*-jry-v1.txt')
    expect(config).toContain('/cookies')
  })
})
