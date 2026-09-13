import type { PublicProfile, ProfileRow } from '~/types/auth'

export const AUTH_PROVIDERS = ['email', 'google'] as const
export const AUTH_NEXT_STORAGE_KEY = 'jry-auth-next'
export const AUTH_POLICY_STORAGE_KEY = 'jry-auth-policies'

export const AUTH_CALLBACK_OTP_TYPES = ['signup', 'invite', 'magiclink', 'recovery', 'email_change', 'email'] as const

export type AuthCallbackOtpType = (typeof AUTH_CALLBACK_OTP_TYPES)[number]

export function authCallbackOtpType(value: unknown): AuthCallbackOtpType {
  return AUTH_CALLBACK_OTP_TYPES.includes(value as AuthCallbackOtpType)
    ? value as AuthCallbackOtpType
    : 'signup'
}

export function buildAuthConfirmUrl(siteUrl: string, tokenHash: string, type: AuthCallbackOtpType = 'signup') {
  const origin = siteUrl.replace(/\/$/, '') || 'http://localhost:3000'
  const url = new URL('/confirm', `${origin}/`)
  url.searchParams.set('token_hash', tokenHash)
  url.searchParams.set('type', type)
  return url.toString()
}

export function rememberPendingPolicies(policies: {
  termsAccepted: boolean
  privacyAcknowledged: boolean
  marketingOptIn?: boolean
}) {
  if (!import.meta.client) {
    return
  }

  if (policies.termsAccepted && policies.privacyAcknowledged) {
    sessionStorage.setItem(AUTH_POLICY_STORAGE_KEY, JSON.stringify({
      termsAccepted: true,
      privacyAcknowledged: true,
      marketingOptIn: Boolean(policies.marketingOptIn),
    }))
    return
  }

  sessionStorage.removeItem(AUTH_POLICY_STORAGE_KEY)
}

export function readPendingPolicies() {
  if (!import.meta.client) {
    return null
  }

  try {
    const raw = sessionStorage.getItem(AUTH_POLICY_STORAGE_KEY)
    if (!raw) {
      return null
    }

    const parsed = JSON.parse(raw) as {
      termsAccepted?: boolean
      privacyAcknowledged?: boolean
      marketingOptIn?: boolean
    }

    if (parsed.termsAccepted && parsed.privacyAcknowledged) {
      return parsed
    }
  }
  catch {
    sessionStorage.removeItem(AUTH_POLICY_STORAGE_KEY)
  }

  return null
}

export function clearPendingPolicies() {
  if (import.meta.client) {
    sessionStorage.removeItem(AUTH_POLICY_STORAGE_KEY)
  }
}

export function policiesFromUserMetadata(metadata: Record<string, unknown> | null | undefined) {
  const value = (key: string) => {
    const next = metadata?.[key]
    return typeof next === 'string' ? next.trim() : ''
  }

  if (!value('terms_version') || !value('privacy_policy_version')) {
    return null
  }

  return {
    termsAccepted: true,
    privacyAcknowledged: true,
    marketingOptIn: metadata?.marketing_opt_in === true || metadata?.marketing_opt_in === 'true',
  }
}

export function namesFromUserMetadata(metadata: Record<string, unknown> | null | undefined) {
  const value = (key: string) => {
    const next = metadata?.[key]
    return typeof next === 'string' ? next.trim() : ''
  }

  const fullName = value('full_name') || value('name')
  const parts = fullName.split(/\s+/).filter(Boolean)

  return {
    firstName: value('first_name') || value('given_name') || parts[0] || '',
    lastName: value('last_name') || value('family_name') || parts.slice(1).join(' '),
  }
}

export function needsPolicyAcceptance(profile: Pick<PublicProfile, 'termsVersion' | 'privacyPolicyVersion'> | null) {
  if (!profile) {
    return false
  }

  return !profile.termsVersion || !profile.privacyPolicyVersion
}

export function isSafeRedirectPath(path: unknown): path is string {
  return typeof path === 'string'
    && path.startsWith('/')
    && !path.startsWith('//')
    && !path.startsWith('/\\')
}

export function safeRedirectPath(path: unknown, fallback = '/dashboard'): string {
  return isSafeRedirectPath(path) ? path : fallback
}

export function accountHomePath(role?: string | null) {
  return role === 'admin' ? '/admin' : '/dashboard'
}

export function resolvePostLoginPath(requested: unknown, role?: string | null) {
  const home = accountHomePath(role)

  if (!isSafeRedirectPath(requested)) {
    return home
  }

  if (role === 'admin' && (requested === '/dashboard' || requested === '/dashboard/')) {
    return home
  }

  return requested
}

export function toPublicProfile(
  row: ProfileRow,
  email: string | null,
  emailVerified: boolean,
): PublicProfile {
  return {
    uuid: row.uuid,
    role: row.role,
    firstName: row.first_name,
    lastName: row.last_name,
    phone: row.phone,
    email,
    emailVerified,
    privacyPolicyVersion: row.privacy_policy_version ?? null,
    privacyAcceptedAt: row.privacy_accepted_at ?? null,
    termsVersion: row.terms_version ?? null,
    termsAcceptedAt: row.terms_accepted_at ?? null,
    marketingOptIn: Boolean(row.marketing_opt_in),
  }
}

export function extractAuthErrorMessage(error: unknown): string {
  if (typeof error === 'string') {
    const fromJson = messageFromJson(error)
    return fromJson || error
  }

  if (error && typeof error === 'object') {
    const record = error as Record<string, unknown>
    const payload = nestedErrorPayload(record.data)
    if (payload) {
      return payload
    }

    if (typeof record.msg === 'string' && record.msg.trim()) {
      return record.msg
    }

    if (typeof record.statusMessage === 'string' && record.statusMessage.trim()) {
      return record.statusMessage
    }

    if (typeof record.message === 'string' && record.message.trim()) {
      return messageFromJson(record.message) || record.message
    }
  }

  return 'We could not complete that request. Please try again.'
}

function nestedErrorPayload(value: unknown): string {
  if (!value || typeof value !== 'object') {
    return ''
  }

  const record = value as Record<string, unknown>
  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message
  }

  if (typeof record.statusMessage === 'string' && record.statusMessage.trim()) {
    return record.statusMessage
  }

  return nestedErrorPayload(record.data)
}

function messageFromJson(value: string) {
  const trimmed = value.trim()
  if (!trimmed.startsWith('{')) {
    return ''
  }

  try {
    const parsed = JSON.parse(trimmed) as { msg?: unknown, message?: unknown }
    if (typeof parsed.msg === 'string' && parsed.msg.trim()) {
      return parsed.msg
    }
    if (typeof parsed.message === 'string' && parsed.message.trim()) {
      return parsed.message
    }
  }
  catch {
    return ''
  }

  return ''
}

export function mapAuthError(message: string): string {
  const normalized = message.toLowerCase()

  if (normalized.includes('invalid login') || normalized.includes('invalid credentials')) {
    return 'Email or password is incorrect.'
  }

  if (normalized.includes('already registered') || normalized.includes('already been registered')) {
    return 'An account with this email already exists.'
  }

  if (normalized.includes('email not confirmed')) {
    return 'Please verify your email before signing in.'
  }

  if (
    normalized.includes('flow state')
    || normalized.includes('code verifier')
    || normalized.includes('both auth code and code verifier')
  ) {
    return 'Open the confirmation link in the same browser you used to create the account, or request a new email.'
  }

  if (
    normalized.includes('otp_expired')
    || normalized.includes('token has expired')
    || normalized.includes('invalid token')
    || normalized.includes('confirmation link')
  ) {
    return 'This confirmation link is invalid or has expired. Request a new one from the verify email page.'
  }

  if (normalized.includes('rate limit') || normalized.includes('too many')) {
    return 'Too many attempts. Please wait and try again.'
  }

  if (normalized.includes('provider is not enabled') || normalized.includes('unsupported provider')) {
    return 'Google sign-in is not enabled yet. Use email and password, or ask the operator to enable Google in Supabase Auth.'
  }

  if (normalized.includes('access_denied') || normalized.includes('oauth')) {
    return 'Google sign-in was cancelled or could not be completed. Please try again.'
  }

  if (normalized.includes('already exists') || normalized.includes('already in use')) {
    return 'An account with this email already exists.'
  }

  if (normalized.includes('database error') || normalized.includes('saving new user')) {
    return 'We could not create that account. Try again in a moment, or use a different email.'
  }

  if (normalized.includes('smtp') || normalized.includes('email sending is not configured')) {
    return 'We could not send the confirmation email. Check Gmail SMTP settings and try again.'
  }

  if (normalized.includes('password should') || normalized.includes('password must')) {
    return 'Please choose a stronger password of at least 8 characters.'
  }

  if (looksLikeInternalAuthError(message)) {
    return 'We could not complete that request. Please try again.'
  }

  return message.trim() || 'We could not complete that request. Please try again.'
}

function looksLikeInternalAuthError(message: string) {
  const normalized = message.toLowerCase()
  return !message.trim()
    || message.length >= 220
    || normalized.includes('{')
    || normalized.includes(' at ')
    || normalized.includes('relation ')
    || normalized.includes('violates')
    || normalized.includes('constraint')
    || normalized.includes('permission denied')
    || normalized.includes('jwt')
    || normalized.includes('service role')
    || normalized.includes('stack')
}
