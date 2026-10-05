import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'

export function createWaiverInviteToken() {
  return randomBytes(32).toString('base64url')
}

export function hashWaiverInviteToken(token: string) {
  return createHash('sha256').update(token).digest('hex')
}

export function waiverInviteTokenMatches(expectedHash: string, token: string) {
  const provided = hashWaiverInviteToken(token)
  const left = Buffer.from(expectedHash)
  const right = Buffer.from(provided)
  if (left.length !== right.length) {
    return false
  }

  return timingSafeEqual(left, right)
}
