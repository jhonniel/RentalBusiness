import { randomBytes } from 'node:crypto'

const PLACEHOLDER_BOOKING_EMAIL_DOMAIN = 'guests.jryrentals.online'

export function createPlaceholderBookingEmail() {
  return `booking.${randomBytes(12).toString('hex')}@${PLACEHOLDER_BOOKING_EMAIL_DOMAIN}`
}

export function isPlaceholderBookingEmail(email: string | null | undefined) {
  if (!email) {
    return false
  }
  const normalized = email.trim().toLowerCase()
  return normalized.startsWith('booking.') && normalized.endsWith(`@${PLACEHOLDER_BOOKING_EMAIL_DOMAIN}`)
}
