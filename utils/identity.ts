import type { PublicRentalIdentity } from '~/types/rental'

export const IDENTITY_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const IDENTITY_IMAGE_MAX_BYTES = 5 * 1024 * 1024

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
  return Boolean(value && IDENTITY_IMAGE_TYPES.includes(value as typeof IDENTITY_IMAGE_TYPES[number]))
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
