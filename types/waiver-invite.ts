import type { PublicRentalItem } from '~/types/rental'
import type { PublicWaiverVersion } from '~/types/waiver'

export interface PublicWaiverInvite {
  uuid: string
  expiresAt: string
  signed: boolean
  canSign: boolean
  canEditSchedule: boolean
  identitySubmitted: boolean
  canUploadIdentity: boolean
  signerName: string | null
  contact: {
    firstName: string
    lastName: string
    email: string | null
    phone: string | null
    emailLocked: boolean
  }
  rental: {
    code: string
    startsOn: string
    endsOn: string
    pickupTime: string
    items: PublicRentalItem[]
    totalAmount: number
    depositAmount: number
    amountDue: number
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
