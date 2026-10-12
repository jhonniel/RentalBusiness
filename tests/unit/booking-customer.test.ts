import { describe, expect, it } from 'vitest'
import { isExistingAuthEmailError } from '../../server/utils/auth-email-error'
import { isPlaceholderBookingEmail } from '../../server/utils/placeholder-booking-email'

describe('booking customer email match', () => {
  it('treats an existing auth email as a match', () => {
    expect(isExistingAuthEmailError({ code: 'email_exists', message: 'already been registered' })).toBe(true)
    expect(isExistingAuthEmailError({ message: 'A user with this email address has already been registered' })).toBe(true)
  })

  it('does not treat other auth failures as an existing account', () => {
    expect(isExistingAuthEmailError({ message: 'Password should be at least 6 characters.' })).toBe(false)
    expect(isExistingAuthEmailError(null)).toBe(false)
  })

  it('recognizes a walk-in booking address', () => {
    expect(isPlaceholderBookingEmail('booking.abc123@guests.jryrentals.online')).toBe(true)
    expect(isPlaceholderBookingEmail('ana@example.com')).toBe(false)
  })
})
