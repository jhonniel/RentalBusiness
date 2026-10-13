import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { AcceptAdminWaiverInput, AcceptWaiverInput, AcceptWaiverInviteInput, CompleteWaiverInviteContactInput, PublishWaiverInput, SendWaiverInviteInput } from '../../utils/waiver-validation'
import type { UpdateWaiverInviteScheduleInput } from '../../utils/rental-validation'
import { EMAIL_TEMPLATES } from '../../utils/email'
import { waiverInviteEmail } from '../../utils/email-templates'
import { CURRENT_PRIVACY_POLICY_VERSION } from '../../utils/privacy-policy'
import { CURRENT_TERMS_VERSION } from '../../utils/terms'
import { canSendWaiverInvite, canUploadGuestIdentity, canResetAdminWaiver, canContinueAdminRental, isWaiverInviteOpen, isWaiverInviteUnexpired, waiverInviteExpiresAt, waiverInviteUrl, canSendGuestRentalLink, WAIVER_INVITE_STATUSES } from '../../utils/waiver-invite'
import { renderWaiverBody, toPublicWaiverAcceptance, toPublicWaiverVersion } from '../../utils/waiver'
import { findProfileById, stampPrivacyAcknowledgment, stampTermsAcceptance, updateOwnProfile } from '../repositories/profile.repository'
import { isExistingAuthEmailError } from '../utils/auth-email-error'
import { isPlaceholderBookingEmail } from '../utils/placeholder-booking-email'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import { findRentalIdentity, findRentalIdentityById, insertRentalStatusHistory, updateRentalDraft, updateRentalItemByRentalId } from '../repositories/rental.repository'
import {
  expireOpenWaiverInvites,
  findWaiverInviteByUuid,
  insertWaiverInvite,
  markWaiverInviteUsed,
  reopenLatestWaiverInvite,
} from '../repositories/waiver-invite.repository'
import { getProductAvailabilityCalendar } from './availability.service'
import { expireUnconfirmedRentals } from './cron.service'
import { sendTemplatedEmail } from './email.service'
import { buildQuote } from './rental.service'
import { getSupabaseAdminClient } from '../utils/supabase'
import { createWaiverInviteToken, hashWaiverInviteToken, waiverInviteTokenMatches } from '../utils/waiver-invite-token'
import {
  findCurrentWaiverVersion,
  findWaiverAcceptanceByRentalId,
  findWaiverAcceptanceByUuid,
  findWaiverVersionByUuid,
  deleteWaiverAcceptanceByRentalId,
  insertWaiverAcceptance,
  insertWaiverVersion,
  listWaiverVersions,
  setWaiverVersionCurrent,
  unsetCurrentWaiverVersions,
} from '../repositories/waiver.repository'
import { amountDue } from '../../utils/rental'
import { getOwnRental } from './rental.service'
import { getAdminRental } from './admin-rental.service'
import { buildWaiverPdf, signatureHasInk, waiverPdfFilename } from '../utils/waiver-pdf'

type Client = SupabaseClient<Database>

function requestIp(event: H3Event) {
  const ip = getRequestIP(event, { xForwardedFor: true })
  if (!ip || ip.length > 45 || !/^[0-9a-fA-F.:]+$/.test(ip)) {
    return null
  }
  return ip
}

function requestUserAgent(event: H3Event) {
  const value = getHeader(event, 'user-agent')?.trim()
  return value ? value.slice(0, 512) : null
}

function siteOrigin() {
  const config = useRuntimeConfig()
  return String(config.public.siteUrl || process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

async function customerAccountEmail(userId: string) {
  const admin = getSupabaseAdminClient()
  const { data, error } = await admin.auth.admin.getUserById(userId)
  if (error || !data.user?.email) {
    return null
  }
  return data.user.email
}

function toPublicWaiverInviteRental(rental: Awaited<ReturnType<typeof getAdminRental>>) {
  return {
    code: rental.code,
    startsOn: rental.startsOn,
    endsOn: rental.endsOn,
    pickupTime: rental.pickupTime,
    items: rental.items,
    totalAmount: rental.totalAmount,
    depositAmount: rental.depositAmount,
    amountDue: amountDue(rental),
    customer: rental.customer
      ? {
          firstName: rental.customer.firstName,
          lastName: rental.customer.lastName,
          phone: rental.customer.phone,
        }
      : null,
  }
}

export async function getCurrentWaiver(client: Client) {
  const row = await findCurrentWaiverVersion(client)
  if (!row) {
    throw new AppError('No current waiver is published.', 404, ERROR_CODES.NOT_FOUND)
  }

  return toPublicWaiverVersion(row)
}

export async function acceptWaiver(
  event: H3Event,
  client: Client,
  profileId: number,
  input: AcceptWaiverInput,
  account: { email: string | null, phone: string | null },
) {
  const rental = await getOwnRental(client, input.rentalUuid || input.rentalCode || '')

  if (!(WAIVER_INVITE_STATUSES as readonly string[]).includes(rental.status)) {
    throw new AppError('That rental can no longer accept a waiver.', 409, ERROR_CODES.CONFLICT)
  }

  if (rental.waiver) {
    throw new AppError('This rental already has a signed waiver.', 409, ERROR_CODES.CONFLICT)
  }

  const version = await findWaiverVersionByUuid(client, input.waiverVersionUuid)
  if (!version) {
    throw new AppError('Waiver version not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  if (!version.is_current) {
    throw new AppError('The waiver was updated. Please review the new version.', 409, ERROR_CODES.CONFLICT)
  }

  const identity = await findRentalIdentity(client, rental.uuid)
  if (!identity) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const existing = await findWaiverAcceptanceByRentalId(client, identity.id)
  if (existing) {
    throw new AppError('This rental already has a signed waiver.', 409, ERROR_CODES.CONFLICT)
  }

  if (!(await signatureHasInk(input.signatureData))) {
    throw new AppError('Draw your signature on the pad.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  const row = await insertWaiverAcceptance(client, {
    waiver_version_id: version.id,
    rental_id: identity.id,
    customer_id: profileId,
    signer_name: input.signerName,
    signer_email: account.email,
    signer_phone: account.phone,
    signature_data: input.signatureData,
    ip_address: requestIp(event),
    user_agent: requestUserAgent(event),
    privacy_policy_version: CURRENT_PRIVACY_POLICY_VERSION,
    terms_version: CURRENT_TERMS_VERSION,
  })

  await stampPrivacyAcknowledgment(client, profileId, CURRENT_PRIVACY_POLICY_VERSION)
  await stampTermsAcceptance(client, profileId, CURRENT_TERMS_VERSION)

  const acceptance = toPublicWaiverAcceptance(row)
  await recordAudit(event, client, {
    action: 'waiver.accept',
    entity: 'waiver_acceptances',
    entityId: acceptance.uuid,
    next: {
      rentalUuid: rental.uuid,
      rentalCode: rental.code,
      waiverVersion: version.version,
      privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      termsVersion: CURRENT_TERMS_VERSION,
      signerName: acceptance.signerName,
      signerEmail: acceptance.signerEmail,
      signerPhone: acceptance.signerPhone,
    },
  })

  return acceptance
}

export async function acceptAdminRentalWaiver(
  event: H3Event,
  client: Client,
  identifier: string,
  input: AcceptAdminWaiverInput,
) {
  const rental = await getAdminRental(client, identifier)
  if (!canSendWaiverInvite(rental)) {
    throw new AppError(
      rental.waiver
        ? 'This rental already has a signed waiver.'
        : 'That rental can no longer accept a waiver.',
      409,
      ERROR_CODES.CONFLICT,
    )
  }

  const version = await findWaiverVersionByUuid(client, input.waiverVersionUuid)
  if (!version) {
    throw new AppError('Waiver version not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  if (!version.is_current) {
    throw new AppError('The waiver was updated. Please review the new version.', 409, ERROR_CODES.CONFLICT)
  }

  const identity = await findRentalIdentity(client, rental.uuid)
  const customer = identity ? await findProfileById(client, identity.customer_id) : null
  if (!identity || !customer) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const existing = await findWaiverAcceptanceByRentalId(client, identity.id)
  if (existing) {
    throw new AppError('This rental already has a signed waiver.', 409, ERROR_CODES.CONFLICT)
  }

  if (!(await signatureHasInk(input.signatureData))) {
    throw new AppError('Draw your signature on the pad.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  const accountEmail = await customerAccountEmail(customer.user_id)
  const email = accountEmail && !isPlaceholderBookingEmail(accountEmail) ? accountEmail : null
  const row = await insertWaiverAcceptance(client, {
    waiver_version_id: version.id,
    rental_id: identity.id,
    customer_id: identity.customer_id,
    signer_name: input.signerName,
    signer_email: email,
    signer_phone: rental.customer?.phone || customer.phone,
    signature_data: input.signatureData,
    ip_address: requestIp(event),
    user_agent: requestUserAgent(event),
    privacy_policy_version: CURRENT_PRIVACY_POLICY_VERSION,
    terms_version: CURRENT_TERMS_VERSION,
  })

  await stampPrivacyAcknowledgment(client, identity.customer_id, CURRENT_PRIVACY_POLICY_VERSION)
  await stampTermsAcceptance(client, identity.customer_id, CURRENT_TERMS_VERSION)

  const acceptance = toPublicWaiverAcceptance(row)
  await recordAudit(event, client, {
    action: 'waiver.accept',
    entity: 'waiver_acceptances',
    entityId: acceptance.uuid,
    next: {
      rentalUuid: rental.uuid,
      rentalCode: rental.code,
      waiverVersion: version.version,
      privacyPolicyVersion: CURRENT_PRIVACY_POLICY_VERSION,
      termsVersion: CURRENT_TERMS_VERSION,
      signerName: acceptance.signerName,
      signerEmail: acceptance.signerEmail,
      signerPhone: acceptance.signerPhone,
      recordedBy: 'admin',
    },
  })

  return acceptance
}

export async function resetAdminRentalWaiver(
  event: H3Event,
  client: Client,
  identifier: string,
) {
  const rental = await getAdminRental(client, identifier)
  if (!canResetAdminWaiver(rental)) {
    throw new AppError(
      rental.waiver
        ? 'That rental can no longer be unsigned for a new signature.'
        : 'This rental does not have a signed waiver.',
      409,
      ERROR_CODES.CONFLICT,
    )
  }

  const identity = await findRentalIdentity(client, rental.uuid)
  if (!identity) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const existing = await findWaiverAcceptanceByRentalId(client, identity.id)
  if (!existing) {
    throw new AppError('This rental does not have a signed waiver.', 409, ERROR_CODES.CONFLICT)
  }

  await recordAudit(event, client, {
    action: 'waiver.reset',
    entity: 'waiver_acceptances',
    entityId: existing.uuid,
    previous: {
      rentalUuid: rental.uuid,
      rentalCode: rental.code,
      signerName: existing.signer_name,
      acceptedAt: existing.accepted_at,
      waiverVersion: Array.isArray(existing.waiver_versions)
        ? existing.waiver_versions[0]?.version
        : existing.waiver_versions?.version,
    },
    next: { status: 'unsigned' },
  })

  await deleteWaiverAcceptanceByRentalId(client, identity.id)
  await reopenLatestWaiverInvite(client, identity.id, waiverInviteExpiresAt())

  return getAdminRental(client, rental.uuid)
}

export async function sendAdminWaiverInvite(
  event: H3Event,
  client: Client,
  profileId: number,
  identifier: string,
  input: SendWaiverInviteInput,
) {
  const rental = await getAdminRental(client, identifier)
  if (!canSendGuestRentalLink(rental)) {
    throw new AppError(
      rental.waiver
        ? 'That rental can no longer use a customer link.'
        : 'That rental can no longer accept a waiver.',
      409,
      ERROR_CODES.CONFLICT,
    )
  }

  const identity = await findRentalIdentity(client, rental.uuid)
  const customer = identity ? await findProfileById(client, identity.customer_id) : null
  if (!identity || !customer) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const accountEmail = await customerAccountEmail(customer.user_id)
  const email = input.email?.trim() || (accountEmail && !isPlaceholderBookingEmail(accountEmail) ? accountEmail : null)

  await expireOpenWaiverInvites(client, identity.id)
  const token = createWaiverInviteToken()
  const invite = await insertWaiverInvite(client, {
    rental_id: identity.id,
    token_hash: hashWaiverInviteToken(token),
    email,
    expires_at: waiverInviteExpiresAt(),
    created_by: profileId,
  })
  const waiverUrl = waiverInviteUrl(siteOrigin(), invite.uuid, token)
  const customerName = [customer.first_name, customer.last_name].filter(Boolean).join(' ') || 'there'

  let sent = false
  if (email) {
    try {
      await sendTemplatedEmail(client, {
        to: email,
        template: EMAIL_TEMPLATES.RENTAL_WAIVER_INVITE,
        entityKey: invite.uuid,
        ...waiverInviteEmail({
          customerName,
          rentalCode: rental.code,
          startsOn: rental.startsOn,
          endsOn: rental.endsOn,
          waiverUrl,
        }),
      })
      sent = true
    }
    catch {
      sent = false
    }
  }

  await recordAudit(event, client, {
    action: 'waiver.invite.send',
    entity: 'rental_waiver_invites',
    entityId: invite.uuid,
    next: { rentalCode: rental.code, email, sent },
  })

  return {
    uuid: invite.uuid,
    expiresAt: invite.expires_at,
    sent,
    waiverUrl,
  }
}

export async function getPublicWaiverInvite(client: Client, uuid: string, token: string) {
  const invite = await findWaiverInviteByUuid(client, uuid)
  if (!invite || !waiverInviteTokenMatches(invite.token_hash, token) || !isWaiverInviteUnexpired({
    expiresAt: invite.expires_at,
  })) {
    throw new AppError('This sign link is invalid or has expired.', 404, ERROR_CODES.NOT_FOUND)
  }

  const identity = await findRentalIdentityById(client, invite.rental_id)
  if (!identity) {
    throw new AppError('This sign link is invalid or has expired.', 404, ERROR_CODES.NOT_FOUND)
  }

  const rental = await getAdminRental(client, identity.uuid)
  const signed = Boolean(rental.waiver)
  const identitySubmitted = Boolean(rental.identity)
  const canSign = isWaiverInviteOpen({
    usedAt: invite.used_at,
    expiresAt: invite.expires_at,
  }) && canSendWaiverInvite(rental)

  if (!signed && !canSign) {
    throw new AppError(
      rental.waiver
        ? 'This rental already has a signed waiver.'
        : 'This sign link is invalid or has expired.',
      409,
      ERROR_CODES.CONFLICT,
    )
  }

  const waiver = rental.waiver
    ? {
        uuid: rental.waiver.version.uuid,
        version: rental.waiver.version.version,
        title: rental.waiver.version.title,
        body: rental.waiver.version.body,
        isCurrent: false,
        publishedAt: null,
      }
    : await getCurrentWaiver(client)

  const profile = await findProfileById(client, identity.customer_id)
  const accountEmail = profile ? await customerAccountEmail(profile.user_id) : null
  const contactEmail = accountEmail && !isPlaceholderBookingEmail(accountEmail) ? accountEmail : null

  return {
    uuid: invite.uuid,
    expiresAt: invite.expires_at,
    signed,
    canSign,
    canEditSchedule: canSign && canContinueAdminRental(rental),
    identitySubmitted,
    canUploadIdentity: canUploadGuestIdentity(rental),
    signerName: rental.waiver?.signerName || null,
    contact: {
      firstName: profile?.first_name || '',
      lastName: profile?.last_name || '',
      email: contactEmail,
      phone: profile?.phone || null,
      emailLocked: Boolean(contactEmail),
    },
    rental: toPublicWaiverInviteRental(rental),
    waiver,
  }
}

export async function acceptWaiverInvite(
  event: H3Event,
  client: Client,
  uuid: string,
  input: AcceptWaiverInviteInput,
) {
  const invite = await findWaiverInviteByUuid(client, uuid)
  if (!invite || !waiverInviteTokenMatches(invite.token_hash, input.token) || !isWaiverInviteOpen({
    usedAt: invite.used_at,
    expiresAt: invite.expires_at,
  })) {
    throw new AppError('This sign link is invalid or has expired.', 404, ERROR_CODES.NOT_FOUND)
  }

  const identity = await findRentalIdentityById(client, invite.rental_id)
  if (!identity) {
    throw new AppError('This sign link is invalid or has expired.', 404, ERROR_CODES.NOT_FOUND)
  }

  const rental = await getAdminRental(client, identity.uuid)
  const profile = await findProfileById(client, identity.customer_id)
  const accountEmail = profile ? await customerAccountEmail(profile.user_id) : null
  const phone = profile?.phone?.trim() || ''
  if (
    !profile
    || !rental.identity
    || !profile.first_name.trim()
    || !profile.last_name.trim()
    || !phone
    || !accountEmail
    || isPlaceholderBookingEmail(accountEmail)
  ) {
    throw new AppError(
      'Enter your name, email, and phone number, and photograph your ID, before you sign.',
      422,
      ERROR_CODES.VALIDATION_ERROR,
    )
  }

  const acceptance = await acceptWaiver(event, client, identity.customer_id, {
    rentalUuid: rental.uuid,
    rentalCode: rental.code,
    waiverVersionUuid: input.waiverVersionUuid,
    signerName: input.signerName,
    signatureData: input.signatureData,
  }, {
    email: accountEmail,
    phone,
  })

  await markWaiverInviteUsed(client, invite.uuid)
  return acceptance
}

export async function completeWaiverInviteContact(
  client: Client,
  uuid: string,
  input: CompleteWaiverInviteContactInput,
) {
  const invite = await findWaiverInviteByUuid(client, uuid)
  if (!invite || !waiverInviteTokenMatches(invite.token_hash, input.token) || !isWaiverInviteOpen({
    usedAt: invite.used_at,
    expiresAt: invite.expires_at,
  })) {
    throw new AppError('This sign link is invalid or has expired.', 404, ERROR_CODES.NOT_FOUND)
  }

  const identity = await findRentalIdentityById(client, invite.rental_id)
  if (!identity) {
    throw new AppError('This sign link is invalid or has expired.', 404, ERROR_CODES.NOT_FOUND)
  }

  const rental = await getAdminRental(client, identity.uuid)
  if (!canSendWaiverInvite(rental)) {
    throw new AppError('This waiver is already signed.', 409, ERROR_CODES.CONFLICT)
  }

  const profile = await findProfileById(client, identity.customer_id)
  if (!profile) {
    throw new AppError('This sign link is invalid or has expired.', 404, ERROR_CODES.NOT_FOUND)
  }

  const nextEmail = input.email.trim().toLowerCase()
  if (isPlaceholderBookingEmail(nextEmail)) {
    throw new AppError('Enter a valid email.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  await updateOwnProfile(client, profile.user_id, {
    firstName: input.firstName,
    lastName: input.lastName,
    phone: input.phone,
  })

  const currentEmail = await customerAccountEmail(profile.user_id)
  if (!currentEmail || isPlaceholderBookingEmail(currentEmail)) {
    const admin = getSupabaseAdminClient()
    const updated = await admin.auth.admin.updateUserById(profile.user_id, {
      email: nextEmail,
      email_confirm: true,
    })
    if (updated.error) {
      if (isExistingAuthEmailError(updated.error)) {
        throw new AppError(
          'That email already has an account. Ask the shop to attach this booking to the existing customer.',
          409,
          ERROR_CODES.CONFLICT,
          { cause: updated.error },
        )
      }
      throw new AppError(
        'We could not save that email.',
        422,
        ERROR_CODES.VALIDATION_ERROR,
        { cause: updated.error },
      )
    }
  }

  return { saved: true }
}

async function requireEditableWaiverInvite(client: Client, uuid: string, token: string) {
  const invite = await findWaiverInviteByUuid(client, uuid)
  if (!invite || !waiverInviteTokenMatches(invite.token_hash, token) || !isWaiverInviteOpen({
    usedAt: invite.used_at,
    expiresAt: invite.expires_at,
  })) {
    throw new AppError('This sign link is invalid or has expired.', 404, ERROR_CODES.NOT_FOUND)
  }

  const identity = await findRentalIdentityById(client, invite.rental_id)
  if (!identity) {
    throw new AppError('This sign link is invalid or has expired.', 404, ERROR_CODES.NOT_FOUND)
  }

  const rental = await getAdminRental(client, identity.uuid)
  if (!canSendWaiverInvite(rental) || !canContinueAdminRental(rental)) {
    throw new AppError('Those dates can no longer be changed.', 409, ERROR_CODES.CONFLICT)
  }

  const item = rental.items[0]
  if (!item) {
    throw new AppError('That rental has no equipment.', 409, ERROR_CODES.CONFLICT)
  }

  return { invite, identity, rental, item }
}

export async function getWaiverInviteCalendar(client: Client, uuid: string, token: string) {
  const { rental, item } = await requireEditableWaiverInvite(client, uuid, token)
  return getProductAvailabilityCalendar(client, {
    productUuid: item.product.uuid,
    quantity: item.quantity,
    exceptRentalUuid: rental.uuid,
  })
}

export async function updateWaiverInviteSchedule(
  event: H3Event,
  client: Client,
  uuid: string,
  input: UpdateWaiverInviteScheduleInput,
) {
  await expireUnconfirmedRentals(event).catch(() => undefined)
  const { identity, rental, item } = await requireEditableWaiverInvite(client, uuid, input.token)
  const quote = await buildQuote(client, {
    productUuid: item.product.uuid,
    startsOn: input.startsOn,
    endsOn: input.endsOn,
    pickupTime: input.pickupTime,
    quantity: item.quantity,
  }, {
    exceptRentalUuid: rental.uuid,
  })

  if (!quote.canFulfill) {
    throw new AppError(
      quote.hasBlockedDates
        ? 'Those dates are blocked by the shop.'
        : 'Those dates are not available. Another request already holds that kit.',
      409,
      ERROR_CODES.CONFLICT,
    )
  }

  const discount = Math.min(rental.discountAmount, quote.totalAmount)
  await updateRentalDraft(client, rental.uuid, {
    startsOn: quote.startsOn,
    endsOn: quote.endsOn,
    pickupAt: quote.pickupAt,
    returnAt: quote.returnAt,
    notes: rental.notes,
    subtotal: quote.subtotal,
    depositAmount: quote.depositAmount,
    totalAmount: Math.max(0, quote.totalAmount - discount),
  })

  await updateRentalItemByRentalId(client, identity.id, {
    quantity: quote.quantity,
    dailyPrice: quote.dailyPrice,
    lineTotal: quote.lineTotal,
  })

  await insertRentalStatusHistory(client, {
    rentalId: identity.id,
    fromStatus: rental.status,
    toStatus: rental.status,
    changedBy: identity.customer_id,
    note: 'Customer updated the rental dates from the waiver link.',
  })

  await recordAudit(event, client, {
    action: 'rental.schedule.guest',
    entity: 'rental_requests',
    entityId: rental.uuid,
    previous: { startsOn: rental.startsOn, endsOn: rental.endsOn, pickupTime: rental.pickupTime },
    next: { startsOn: quote.startsOn, endsOn: quote.endsOn, pickupTime: quote.pickupTime },
  })

  return getPublicWaiverInvite(client, uuid, input.token)
}

export async function listAdminWaivers(client: Client) {
  const rows = await listWaiverVersions(client)
  return rows.map(toPublicWaiverVersion)
}

export async function publishWaiverVersion(event: H3Event, client: Client, input: PublishWaiverInput) {
  const previous = await findCurrentWaiverVersion(client)
  await unsetCurrentWaiverVersions(client)

  try {
    const row = await insertWaiverVersion(client, {
      version: input.version,
      title: input.title,
      body: input.body,
      is_current: true,
      published_at: new Date().toISOString(),
    })

    const published = toPublicWaiverVersion(row)
    await recordAudit(event, client, {
      action: 'waiver.publish',
      entity: 'waiver_versions',
      entityId: published.uuid,
      previous: previous ? { version: previous.version, uuid: previous.uuid } : null,
      next: { version: published.version, title: published.title },
    })

    return published
  }
  catch (error) {
    if (previous) {
      await setWaiverVersionCurrent(client, previous.uuid, true)
    }
    throw error
  }
}

export async function sendAdminRentalWaiverPdf(
  event: H3Event,
  client: Client,
  identifier: string,
  download: boolean,
) {
  const rental = await getAdminRental(client, identifier)
  if (!rental.waiver) {
    throw new AppError('No waiver has been accepted on this rental yet.', 404, ERROR_CODES.NOT_FOUND)
  }

  const acceptance = await findWaiverAcceptanceByUuid(client, rental.waiver.uuid)
  const filename = waiverPdfFilename(['JRY-waiver', rental.code, rental.waiver.version.version])
  const pdf = await buildWaiverPdf({
    title: rental.waiver.version.title,
    version: rental.waiver.version.version,
    body: renderWaiverBody(rental.waiver.version.body, rental.items),
    filename,
    rentalCode: rental.code,
    startsOn: rental.startsOn,
    endsOn: rental.endsOn,
    signerName: rental.waiver.signerName,
    signerEmail: rental.waiver.signerEmail,
    signerPhone: rental.waiver.signerPhone,
    acceptedAt: rental.waiver.acceptedAt,
    privacyPolicyVersion: rental.waiver.privacyPolicyVersion,
    termsVersion: rental.waiver.termsVersion,
    signatureDataUrl: acceptance?.signature_data ?? null,
  })

  await recordAudit(event, client, {
    action: 'waiver.pdf.download',
    entity: 'waiver_acceptances',
    entityId: rental.waiver.uuid,
    next: { rentalCode: rental.code, filename },
  })

  setHeader(event, 'content-type', 'application/pdf')
  setHeader(event, 'content-disposition', `${download ? 'attachment' : 'inline'}; filename="${filename}"`)
  return pdf
}

export async function sendAdminWaiverVersionPdf(
  event: H3Event,
  client: Client,
  uuid: string,
  download: boolean,
) {
  const version = await findWaiverVersionByUuid(client, uuid)
  if (!version) {
    throw new AppError('Waiver version not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const filename = waiverPdfFilename(['JRY-waiver', version.version])
  const pdf = await buildWaiverPdf({
    title: version.title,
    version: version.version,
    body: version.body,
    filename,
  })

  await recordAudit(event, client, {
    action: 'waiver.pdf.download',
    entity: 'waiver_versions',
    entityId: version.uuid,
    next: { version: version.version, filename },
  })

  setHeader(event, 'content-type', 'application/pdf')
  setHeader(event, 'content-disposition', `${download ? 'attachment' : 'inline'}; filename="${filename}"`)
  return pdf
}
