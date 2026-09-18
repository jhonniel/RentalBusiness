import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { CURRENT_TERMS_META, CURRENT_TERMS_VERSION } from '../../utils/terms'

describe('terms and conditions', () => {
  it('publishes a versioned document separate from the waiver and privacy policy', () => {
    const source = readFileSync(resolve(process.cwd(), 'supabase/terms-jry-v1.txt'), 'utf8')

    expect(CURRENT_TERMS_VERSION).toBe('JRY-TC-v1.0')
    expect(CURRENT_TERMS_META.title).toBe('Terms & Conditions')
    expect(source).toContain(CURRENT_TERMS_VERSION)
    expect(source).toContain('more than 48 hours')
    expect(source).toContain('Consumer Act')
    expect(source).not.toContain('[INSERT YOUR ACTUAL POLICY HERE]')
    expect(source).not.toContain('Do not publish the example values')
  })

  it('bundles the Terms file from the project supabase folder', () => {
    const config = readFileSync(resolve(process.cwd(), 'nuxt.config.ts'), 'utf8')
    expect(config).toContain('resolvePath(rootDir, \'supabase\')')
    expect(config).toContain('baseName: \'legal\'')
    expect(config).toContain('*-jry-v1.txt')
  })
})
