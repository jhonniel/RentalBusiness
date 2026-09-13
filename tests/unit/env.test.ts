import { describe, expect, it } from 'vitest'
import { isUsableSecret, productionReadiness } from '../../utils/env'
import { resolveSmtpConfig } from '../../utils/smtp'
import { hasUsableSupabaseConfig } from '../../utils/supabase-config'

describe('isUsableSecret', () => {
  it('rejects empty and placeholder values', () => {
    expect(isUsableSecret('')).toBe(false)
    expect(isUsableSecret('  ')).toBe(false)
    expect(isUsableSecret('placeholder')).toBe(false)
    expect(isUsableSecret('https://placeholder.supabase.co')).toBe(false)
    expect(isUsableSecret('live-cron-secret')).toBe(true)
  })
})

describe('productionReadiness', () => {
  it('is ready only when every production secret group is configured', () => {
    const missingWebhook = productionReadiness({
      supabaseConfigured: true,
      serviceRoleConfigured: true,
      cronConfigured: true,
      webhookConfigured: false,
      resendConfigured: true,
    })

    expect(missingWebhook.ready).toBe(false)
    expect(productionReadiness({
      supabaseConfigured: true,
      serviceRoleConfigured: true,
      cronConfigured: true,
      webhookConfigured: true,
      resendConfigured: true,
    }).ready).toBe(true)
  })
})

describe('resolveSmtpConfig', () => {
  it('strips spaces from a 16-character Gmail app password', () => {
    expect(resolveSmtpConfig({
      user: 'jryrentals@gmail.com',
      pass: 'abcd efgh ijkl mnop',
      from: 'jryrentals@gmail.com',
    }).pass).toBe('abcdefghijklmnop')
  })
})

describe('hasUsableSupabaseConfig', () => {
  it('requires a real URL and anon key', () => {
    expect(hasUsableSupabaseConfig('https://example.supabase.co', 'anon-key')).toBe(true)
    expect(hasUsableSupabaseConfig('https://placeholder.supabase.co', 'anon-key')).toBe(false)
  })
})
