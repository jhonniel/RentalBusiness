import type { PublicRental } from '~/types/rental'

export const WAIVER_INVITE_HOURS = 72

export function waiverInviteExpiresAt(now = new Date()) {
  return new Date(now.getTime() + WAIVER_INVITE_HOURS * 60 * 60 * 1000).toISOString()
}

export function isWaiverInviteOpen(invite: {
  usedAt?: string | null
  expiresAt: string
}, now = new Date()) {
  return !invite.usedAt && isWaiverInviteUnexpired(invite, now)
}

export function isWaiverInviteUnexpired(invite: {
  expiresAt: string
}, now = new Date()) {
  return new Date(invite.expiresAt).getTime() > now.getTime()
}

export function canUploadGuestIdentity(rental: Pick<PublicRental, 'status' | 'waiver'>) {
  return ['draft', 'pending'].includes(rental.status) && Boolean(rental.waiver)
}

export const WAIVER_INVITE_STATUSES = [
  'draft',
  'pending',
  'awaiting_payment',
  'paid',
  'approved',
  'ready_for_pickup',
] as const

export function canContinueAdminRental(rental: Pick<PublicRental, 'status'>) {
  return rental.status === 'draft'
}

export function canSendWaiverInvite(rental: Pick<PublicRental, 'status' | 'waiver'>) {
  return (WAIVER_INVITE_STATUSES as readonly string[]).includes(rental.status) && !rental.waiver
}

export function canSendGuestRentalLink(rental: Pick<PublicRental, 'status' | 'waiver'>) {
  return canSendWaiverInvite(rental) || canUploadGuestIdentity(rental)
}

export function canResetAdminWaiver(rental: Pick<PublicRental, 'status' | 'waiver'>) {
  return Boolean(rental.waiver) && (WAIVER_INVITE_STATUSES as readonly string[]).includes(rental.status)
}

export function canOpenAdminContinue(rental: Pick<PublicRental, 'status' | 'waiver'>) {
  return canContinueAdminRental(rental) || canSendGuestRentalLink(rental) || canResetAdminWaiver(rental)
}

export function waiverInviteUnavailableReason(rental: Pick<PublicRental, 'status' | 'waiver'>) {
  if (canSendGuestRentalLink(rental)) {
    return null
  }

  if (rental.waiver) {
    return `This waiver is already signed by ${rental.waiver.signerName}.`
  }

  if (!(WAIVER_INVITE_STATUSES as readonly string[]).includes(rental.status)) {
    return 'A sign link can only be created on an open rental before the customer signs.'
  }

  return null
}

export function waiverInvitePath(uuid: string, token: string) {
  return `/waivers/sign/${uuid}?token=${encodeURIComponent(token)}`
}

export function waiverInviteUrl(origin: string, uuid: string, token: string) {
  return `${origin.replace(/\/$/, '')}${waiverInvitePath(uuid, token)}`
}
