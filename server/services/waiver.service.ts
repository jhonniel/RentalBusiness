import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { AcceptWaiverInput, PublishWaiverInput } from '../../utils/waiver-validation'
import { CURRENT_PRIVACY_POLICY_VERSION } from '../../utils/privacy-policy'
import { CURRENT_TERMS_VERSION } from '../../utils/terms'
import { renderWaiverBody, toPublicWaiverAcceptance, toPublicWaiverVersion } from '../../utils/waiver'
import { stampPrivacyAcknowledgment, stampTermsAcceptance } from '../repositories/profile.repository'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import { findRentalIdentity } from '../repositories/rental.repository'
import {
  findCurrentWaiverVersion,
  findWaiverAcceptanceByRentalId,
  findWaiverAcceptanceByUuid,
  findWaiverVersionByUuid,
  insertWaiverAcceptance,
  insertWaiverVersion,
  listWaiverVersions,
  setWaiverVersionCurrent,
  unsetCurrentWaiverVersions,
} from '../repositories/waiver.repository'
import { getOwnRental } from './rental.service'
import { getAdminRental } from './admin-rental.service'
import { buildWaiverPdf, waiverPdfFilename } from '../utils/waiver-pdf'

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

  if (!['draft', 'pending'].includes(rental.status)) {
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
