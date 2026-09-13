import { describe, expect, it } from 'vitest'
import { isSmtpConfigured, resolveSmtpConfig } from '../../utils/smtp'

describe('resolveSmtpConfig', () => {
  it('defaults to Gmail submission on 587', () => {
    const config = resolveSmtpConfig({
      user: 'hello@gmail.com',
      pass: 'app-password-value',
    })

    expect(config.host).toBe('smtp.gmail.com')
    expect(config.port).toBe(587)
    expect(config.secure).toBe(false)
    expect(config.from).toBe('JRY Rentals <hello@gmail.com>')
    expect(isSmtpConfigured(config)).toBe(true)
  })

  it('uses implicit TLS on 465', () => {
    const config = resolveSmtpConfig({
      user: 'hello@gmail.com',
      pass: 'app-password-value',
      port: 465,
      from: 'JRY Rentals <hello@gmail.com>',
    })

    expect(config.secure).toBe(true)
    expect(isSmtpConfigured(config)).toBe(true)
  })

  it('rejects missing credentials', () => {
    expect(isSmtpConfigured(resolveSmtpConfig({}))).toBe(false)
    expect(isSmtpConfigured(resolveSmtpConfig({ user: 'placeholder', pass: 'secret' }))).toBe(false)
  })
})
