import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { PublicRentalIdentity } from '../../types/rental'
import { canUploadAdminIdentity, toPublicRentalIdentity } from '../../utils/identity'
import { isRentalCode } from '../../utils/rental'
import { isUuid } from '../../utils/slug'
import { STORAGE_BUCKETS } from '../../utils/storage'
import { isWaiverInviteUnexpired } from '../../utils/waiver-invite'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import { compressImageForStorage, type UploadPart } from '../utils/image-compress'
import { findProfileById } from '../repositories/profile.repository'
import {
  findRentalByCode,
  findRentalByUuid,
  findRentalIdentity,
  findRentalIdentityById,
} from '../repositories/rental.repository'
import { findIdentityByRentalId, upsertIdentityVerification } from '../repositories/identity.repository'
import { findWaiverInviteByUuid } from '../repositories/waiver-invite.repository'
import { findWaiverAcceptanceByRentalId } from '../repositories/waiver.repository'
import { waiverInviteTokenMatches } from '../utils/waiver-invite-token'
import { getSupabaseAdminClient } from '../utils/supabase'
import { getOwnRental } from './rental.service'

type Client = SupabaseClient<Database>

async function signedDocumentUrl(path: string) {
  const { data, error } = await getSupabaseAdminClient()
    .storage
    .from(STORAGE_BUCKETS.privateDocuments)
    .createSignedUrl(path, 15 * 60)

  if (error || !data?.signedUrl) {
    return null
  }

  return data.signedUrl
}

export async function submitRentalIdentity(
  event: H3Event,
  client: Client,
  profileId: number,
  userId: string,
  identifier: string,
  files: { governmentId?: UploadPart, selfie?: UploadPart },
): Promise<PublicRentalIdentity> {
  const rental = await getOwnRental(client, identifier)

  if (!['draft', 'pending'].includes(rental.status)) {
    throw new AppError('Identity documents can only be uploaded before payment.', 409, ERROR_CODES.CONFLICT)
  }

  if (!rental.waiver) {
    throw new AppError('Sign the rental waiver before uploading identity documents.', 409, ERROR_CODES.CONFLICT)
  }

  return persistIdentityDocuments(event, client, {
    rentalUuid: rental.uuid,
    rentalCode: rental.code,
    customerId: profileId,
    storageUserId: userId,
    files,
    action: 'rental.identity.submit',
    signUrls: false,
  })
}

export async function submitAdminRentalIdentity(
  event: H3Event,
  client: Client,
  identifier: string,
  files: { governmentId?: UploadPart, selfie?: UploadPart },
): Promise<PublicRentalIdentity> {
  const row = isUuid(identifier)
    ? await findRentalByUuid(client, identifier)
    : isRentalCode(identifier)
      ? await findRentalByCode(client, identifier)
      : null

  if (!row) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  if (!canUploadAdminIdentity({ status: row.status })) {
    throw new AppError('Identity documents can only be uploaded before payment.', 409, ERROR_CODES.CONFLICT)
  }

  const identity = await findRentalIdentity(client, row.uuid)
  const customer = identity ? await findProfileById(client, identity.customer_id) : null
  if (!identity || !customer?.user_id) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  return persistIdentityDocuments(event, client, {
    rentalUuid: row.uuid,
    rentalCode: row.code,
    customerId: identity.customer_id,
    storageUserId: customer.user_id,
    files,
    action: 'rental.identity.admin_submit',
    signUrls: true,
  })
}

export async function submitWaiverInviteIdentity(
  event: H3Event,
  client: Client,
  uuid: string,
  token: string,
  files: { governmentId?: UploadPart, selfie?: UploadPart },
): Promise<PublicRentalIdentity> {
  const invite = await findWaiverInviteByUuid(client, uuid)
  if (!invite || !waiverInviteTokenMatches(invite.token_hash, token) || !isWaiverInviteUnexpired({
    expiresAt: invite.expires_at,
  })) {
    throw new AppError('This sign link is invalid or has expired.', 404, ERROR_CODES.NOT_FOUND)
  }

  const rental = await findRentalIdentityById(client, invite.rental_id)
  const customer = rental ? await findProfileById(client, rental.customer_id) : null
  if (!rental || !customer?.user_id) {
    throw new AppError('This sign link is invalid or has expired.', 404, ERROR_CODES.NOT_FOUND)
  }

  if (!['draft', 'pending'].includes(rental.status)) {
    throw new AppError('Identity documents can only be uploaded before payment.', 409, ERROR_CODES.CONFLICT)
  }

  const waiver = await findWaiverAcceptanceByRentalId(client, rental.id)
  if (!waiver) {
    throw new AppError('Sign the rental waiver before uploading identity documents.', 409, ERROR_CODES.CONFLICT)
  }

  return persistIdentityDocuments(event, client, {
    rentalUuid: rental.uuid,
    rentalCode: rental.code,
    customerId: rental.customer_id,
    storageUserId: customer.user_id,
    files,
    action: 'rental.identity.invite_submit',
    signUrls: false,
  })
}

async function persistIdentityDocuments(
  event: H3Event,
  client: Client,
  input: {
    rentalUuid: string
    rentalCode: string
    customerId: number
    storageUserId: string
    files: { governmentId?: UploadPart, selfie?: UploadPart }
    action: string
    signUrls?: boolean
  },
): Promise<PublicRentalIdentity> {
  const identity = await findRentalIdentity(client, input.rentalUuid)
  if (!identity) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const governmentId = await compressImageForStorage(input.files.governmentId, { label: 'government ID' })
  const selfie = await compressImageForStorage(input.files.selfie, { label: 'selfie holding the ID' })
  const admin = getSupabaseAdminClient()
  const governmentPath = `${input.storageUserId}/rentals/${input.rentalUuid}/government-id.jpg`
  const selfiePath = `${input.storageUserId}/rentals/${input.rentalUuid}/selfie-with-id.jpg`

  const governmentUpload = await admin.storage.from(STORAGE_BUCKETS.privateDocuments).upload(
    governmentPath,
    governmentId.data,
    { contentType: governmentId.type, upsert: true },
  )

  if (governmentUpload.error) {
    throw new AppError('We could not upload that government ID.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: governmentUpload.error })
  }

  const selfieUpload = await admin.storage.from(STORAGE_BUCKETS.privateDocuments).upload(
    selfiePath,
    selfie.data,
    { contentType: selfie.type, upsert: true },
  )

  if (selfieUpload.error) {
    throw new AppError('We could not upload that selfie.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: selfieUpload.error })
  }

  const saved = await upsertIdentityVerification(admin, {
    rental_id: identity.id,
    customer_id: input.customerId,
    government_id_path: governmentPath,
    selfie_path: selfiePath,
  })

  const submitted = input.signUrls === false
    ? toPublicRentalIdentity(saved)
    : await attachAdminIdentityUrls(
      admin,
      input.rentalUuid,
      toPublicRentalIdentity(saved),
    )
  await recordAudit(event, admin, {
    action: input.action,
    entity: 'rental_identity_verifications',
    entityId: input.rentalUuid,
    next: {
      rentalUuid: input.rentalUuid,
      rentalCode: input.rentalCode,
      submittedAt: submitted?.submittedAt,
    },
  })

  if (!submitted) {
    throw new AppError('We could not save those identity documents.', 400, ERROR_CODES.VALIDATION_ERROR)
  }

  return submitted
}

export async function attachAdminIdentityUrls(
  client: Client,
  rentalUuid: string,
  identity: PublicRentalIdentity | null,
): Promise<PublicRentalIdentity | null> {
  if (!identity) {
    return null
  }

  const rental = await findRentalIdentity(client, rentalUuid)
  if (!rental) {
    return identity
  }

  const row = await findIdentityByRentalId(client, rental.id)
  if (!row) {
    return identity
  }

  return toPublicRentalIdentity(row, {
    governmentIdUrl: await signedDocumentUrl(row.government_id_path),
    selfieUrl: await signedDocumentUrl(row.selfie_path),
  })
}
