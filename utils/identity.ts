import type { PublicRentalIdentity } from '~/types/rental'
import {
  IMAGE_UPLOAD_SOURCE_MAX_BYTES,
  IMAGE_UPLOAD_TYPES,
  isImageUploadType,
} from './image-upload'

export const IDENTITY_IMAGE_TYPES = IMAGE_UPLOAD_TYPES
export const IDENTITY_IMAGE_MAX_BYTES = IMAGE_UPLOAD_SOURCE_MAX_BYTES

export interface IdentityVerificationRow {
  uuid?: string
  submitted_at: string
  government_id_path?: string
  selfie_path?: string
}

export function identityImageExtension(contentType: string) {
  if (contentType === 'image/png') {
    return 'png'
  }
  if (contentType === 'image/webp') {
    return 'webp'
  }
  return 'jpg'
}

export function isIdentityImageType(value: string | undefined): value is typeof IDENTITY_IMAGE_TYPES[number] {
  return isImageUploadType(value)
}

export function canUploadAdminIdentity(rental: { status: string }) {
  return ['draft', 'pending'].includes(rental.status)
}

export function toPublicRentalIdentity(
  row: IdentityVerificationRow | IdentityVerificationRow[] | null | undefined,
  urls: { governmentIdUrl?: string | null, selfieUrl?: string | null } = {},
): PublicRentalIdentity | null {
  const next = Array.isArray(row) ? row[0] : row
  if (!next?.submitted_at) {
    return null
  }

  return {
    submittedAt: next.submitted_at,
    governmentIdUrl: urls.governmentIdUrl ?? null,
    selfieUrl: urls.selfieUrl ?? null,
  }
}
