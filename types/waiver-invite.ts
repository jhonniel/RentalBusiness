import type { PublicRentalItem } from '~/types/rental'
import type { PublicWaiverVersion } from '~/types/waiver'

export interface PublicWaiverInvite {
  uuid: string
  expiresAt: string
  signed: boolean
  canSign: boolean
  identitySubmitted: boolean
  canUploadIdentity: boolean
  signerName: string | null
  rental: {
    code: string
    startsOn: string
    endsOn: string
    items: PublicRentalItem[]
    customer: {
      firstName: string
      lastName: string
      phone: string | null
    } | null
  }
  waiver: PublicWaiverVersion | null
}

export interface WaiverInviteSendResult {
  uuid: string
  expiresAt: string
  sent: boolean
  waiverUrl: string
}
