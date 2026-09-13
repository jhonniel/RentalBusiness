import type { PublicWaiverAcceptance, PublicWaiverVersion } from '~/types/waiver'

const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/
const MIN_SIGNATURE_LENGTH = 2500
const MAX_SIGNATURE_LENGTH = 250_000

export interface WaiverVersionRow {
  uuid: string
  version: string
  title: string
  body: string
  is_current: boolean
  published_at: string | null
}

interface WaiverAcceptanceVersionRow {
  uuid: string
  version: string
  title: string
  body: string
}

export interface WaiverAcceptanceRow {
  uuid: string
  signer_name: string
  accepted_at: string
  privacy_policy_version?: string | null
  terms_version?: string | null
  waiver_versions: WaiverAcceptanceVersionRow | WaiverAcceptanceVersionRow[] | null
}

export function isSignatureDataUrl(value: string): boolean {
  if (value.length < MIN_SIGNATURE_LENGTH || value.length > MAX_SIGNATURE_LENGTH) {
    return false
  }

  return PNG_DATA_URL.test(value)
}

function asVersion(value: WaiverAcceptanceRow['waiver_versions']): WaiverAcceptanceVersionRow {
  const row = Array.isArray(value) ? value[0] : value
  if (!row) {
    throw new Error('Waiver acceptance is missing a version.')
  }
  return row
}

export function toPublicWaiverVersion(row: WaiverVersionRow): PublicWaiverVersion {
  return {
    uuid: row.uuid,
    version: row.version,
    title: row.title,
    body: row.body,
    isCurrent: row.is_current,
    publishedAt: row.published_at,
  }
}

export function toPublicWaiverAcceptance(row: WaiverAcceptanceRow): PublicWaiverAcceptance {
  const version = asVersion(row.waiver_versions)
  return {
    uuid: row.uuid,
    signerName: row.signer_name,
    acceptedAt: row.accepted_at,
    privacyPolicyVersion: row.privacy_policy_version ?? null,
    termsVersion: row.terms_version ?? null,
    version: {
      uuid: version.uuid,
      version: version.version,
      title: version.title,
      body: version.body,
    },
  }
}

export function firstWaiverAcceptance(
  value: WaiverAcceptanceRow | WaiverAcceptanceRow[] | null | undefined,
): PublicWaiverAcceptance | null {
  if (!value) {
    return null
  }

  const row = Array.isArray(value) ? value[0] : value
  return row ? toPublicWaiverAcceptance(row) : null
}
