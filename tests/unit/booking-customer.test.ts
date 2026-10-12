import { describe, expect, it } from 'vitest'
import { isExistingAuthEmailError } from '../../server/utils/auth-email-error'

describe('booking customer email match', () => {
  it('treats an existing auth email as a match', () => {
    expect(isExistingAuthEmailError({ code: 'email_exists', message: 'already been registered' })).toBe(true)
    expect(isExistingAuthEmailError({ message: 'A user with this email address has already been registered' })).toBe(true)
  })

  it('does not treat other auth failures as an existing account', () => {
    expect(isExistingAuthEmailError({ message: 'Password should be at least 6 characters.' })).toBe(false)
    expect(isExistingAuthEmailError(null)).toBe(false)
  })
})
