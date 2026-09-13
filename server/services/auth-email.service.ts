import type { RegisterAccountInput } from '../../utils/auth-validation'
import { authCallbackOtpType, buildAuthConfirmUrl } from '../../utils/auth'
import { EMAIL_TEMPLATES } from '../../utils/email'
import { signupConfirmationEmail } from '../../utils/email-templates'
import { CURRENT_PRIVACY_POLICY_VERSION } from '../../utils/privacy-policy'
import { isSmtpConfigured, resolveSmtpConfig } from '../../utils/smtp'
import { CURRENT_TERMS_VERSION } from '../../utils/terms'
import { getSupabaseAdminClient } from '../utils/supabase'
import { AppError, ERROR_CODES } from '../utils/errors'
import { logger } from '../utils/logger'
import { sendTemplatedEmail } from './email.service'

function siteUrl() {
  const config = useRuntimeConfig()
  return String(config.public.siteUrl || process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

function assertSmtpReady() {
  const config = useRuntimeConfig()
  const smtp = resolveSmtpConfig({
    host: String(config.smtpHost || process.env.SMTP_HOST || process.env.NUXT_SMTP_HOST || ''),
    port: config.smtpPort || process.env.SMTP_PORT || process.env.NUXT_SMTP_PORT || '',
    user: String(config.smtpUser || process.env.SMTP_USER || process.env.NUXT_SMTP_USER || ''),
    pass: String(config.smtpPass || process.env.SMTP_PASS || process.env.NUXT_SMTP_PASS || ''),
    from: String(config.smtpFrom || process.env.SMTP_FROM || process.env.NUXT_SMTP_FROM || ''),
  })

  if (!isSmtpConfigured(smtp)) {
    throw new AppError(
      'Email sending is not configured yet. Add Gmail SMTP settings to continue.',
      503,
      ERROR_CODES.INTERNAL_ERROR,
    )
  }
}

function isExistingAccountError(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('already registered')
    || normalized.includes('already been registered')
    || normalized.includes('already exists')
    || normalized.includes('already in use')
}

function authAdminError(error: { message?: string } | null) {
  const message = error?.message || 'We could not complete that request. Please try again.'

  if (isExistingAccountError(message)) {
    return new AppError('An account with this email already exists.', 409, ERROR_CODES.CONFLICT)
  }

  if (message.toLowerCase().includes('database error')) {
    return new AppError(
      'We could not create that account. Try again in a moment, or use a different email.',
      400,
      ERROR_CODES.VALIDATION_ERROR,
    )
  }

  return new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR)
}

function confirmationToken(data: { properties?: { hashed_token?: string, verification_type?: string } | null } | null) {
  const tokenHash = data?.properties?.hashed_token
  if (!tokenHash) {
    return null
  }

  return {
    tokenHash,
    type: data?.properties?.verification_type || 'signup',
  }
}

async function sendSignupConfirmation(input: {
  email: string
  firstName: string
  tokenHash: string
  type: string
}) {
  const mail = signupConfirmationEmail({
    firstName: input.firstName,
    confirmUrl: buildAuthConfirmUrl(siteUrl(), input.tokenHash, authCallbackOtpType(input.type)),
  })

  return sendTemplatedEmail(getSupabaseAdminClient(), {
    to: input.email,
    template: EMAIL_TEMPLATES.AUTH_SIGNUP_CONFIRM,
    entityKey: `${input.email}:${input.tokenHash}`,
    subject: mail.subject,
    html: mail.html,
  })
}

async function createSignupLink(input: RegisterAccountInput) {
  const admin = getSupabaseAdminClient()
  const created = await admin.auth.admin.generateLink({
    type: 'signup',
    email: input.email,
    password: input.password,
    options: {
      data: {
        first_name: input.firstName,
        last_name: input.lastName,
        privacy_policy_version: CURRENT_PRIVACY_POLICY_VERSION,
        terms_version: CURRENT_TERMS_VERSION,
        marketing_opt_in: input.marketingOptIn ? 'true' : 'false',
      },
      redirectTo: `${siteUrl()}/confirm`,
    },
  })

  const createdToken = confirmationToken(created.data)
  if (createdToken) {
    return {
      ...createdToken,
      firstName: input.firstName,
    }
  }

  if (created.error && isExistingAccountError(created.error.message)) {
    const resent = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: input.email,
      options: {
        redirectTo: `${siteUrl()}/confirm`,
      },
    })
    const resentToken = confirmationToken(resent.data)
    if (resentToken) {
      const metadata = resent.data.user?.user_metadata as Record<string, unknown> | undefined
      const firstName = typeof metadata?.first_name === 'string' && metadata.first_name.trim()
        ? metadata.first_name.trim()
        : input.firstName
      return {
        ...resentToken,
        firstName,
      }
    }
  }

  logger.warn('Signup confirmation link was not created', {
    errorName: created.error?.name || 'UnknownError',
    errorMessage: created.error?.message || 'missing-token',
  })
  throw authAdminError(created.error)
}

export async function registerWithConfirmationEmail(input: RegisterAccountInput) {
  assertSmtpReady()

  const link = await createSignupLink(input)
  const sent = await sendSignupConfirmation({
    email: input.email,
    firstName: link.firstName,
    tokenHash: link.tokenHash,
    type: link.type,
  })

  if (sent?.status === 'failed') {
    logger.warn('Signup confirmation email failed after the account was created')
  }

  return {
    email: input.email,
    requiresConfirmation: true,
  }
}

export async function resendSignupConfirmationEmail(email: string) {
  assertSmtpReady()

  const admin = getSupabaseAdminClient()
  const { data, error } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
    options: {
      redirectTo: `${siteUrl()}/confirm`,
    },
  })

  const token = confirmationToken(data)
  if (error || !token) {
    logger.warn('Signup confirmation resend was skipped', {
      errorName: error?.name || 'UnknownError',
      errorMessage: error?.message || 'missing-token',
    })
    return { sent: true }
  }

  const metadata = data.user?.user_metadata as Record<string, unknown> | undefined
  const firstName = typeof metadata?.first_name === 'string' && metadata.first_name.trim()
    ? metadata.first_name.trim()
    : 'there'

  await sendSignupConfirmation({
    email,
    firstName,
    tokenHash: token.tokenHash,
    type: token.type || 'magiclink',
  })

  return { sent: true }
}
