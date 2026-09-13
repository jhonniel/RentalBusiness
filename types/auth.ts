import type { UserRole } from '~/utils/constants'

export interface PublicProfile {
  uuid: string
  role: UserRole
  firstName: string
  lastName: string
  phone: string | null
  email: string | null
  emailVerified: boolean
  privacyPolicyVersion: string | null
  privacyAcceptedAt: string | null
  termsVersion: string | null
  termsAcceptedAt: string | null
  marketingOptIn: boolean
}

export interface ProfileRow {
  id?: number
  uuid: string
  user_id: string
  role: UserRole
  first_name: string
  last_name: string
  phone: string | null
  privacy_policy_version?: string | null
  privacy_accepted_at?: string | null
  terms_version?: string | null
  terms_accepted_at?: string | null
  marketing_opt_in?: boolean
}
