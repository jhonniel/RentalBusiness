export const CURRENT_PRIVACY_POLICY_VERSION = 'JRY-PRIVACY-v1.0'

export const CURRENT_PRIVACY_POLICY_META = {
  version: CURRENT_PRIVACY_POLICY_VERSION,
  title: 'Privacy Policy',
  effectiveDate: '2026-09-13',
  lastUpdated: '2026-09-13',
} as const

export interface PublicPrivacyPolicy {
  version: string
  title: string
  effectiveDate: string
  lastUpdated: string
  body: string
}
