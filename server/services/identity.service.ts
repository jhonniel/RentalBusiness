import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { PublicRentalIdentity } from '../../types/rental'
import {
  IDENTITY_IMAGE_MAX_BYTES,
  identityImageExtension,
  isIdentityImageType,
  toPublicRentalIdentity,
} from '../../utils/identity'
import { STORAGE_BUCKETS } from '../../utils/storage'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import { findRentalIdentity } from '../repositories/rental.repository'
import { findIdentityByRentalId, upsertIdentityVerification } from '../repositories/identity.repository'
import { getSupabaseAdminClient } from '../utils/supabase'
import { getOwnRental } from './rental.service'

type Client = SupabaseClient<Database>
type UploadPart = { filename?: string, type?: string, data: Buffer }

function assertIdentityImage(file: UploadPart | undefined, label: string) {
  if (!file?.data?.byteLength) {
    throw new AppError(`Upload a ${label}.`, 422, ERROR_CODES.VALIDATION_ERROR)
  }

  if (!isIdentityImageType(file.type)) {
    throw new AppError('Upload a JPG, PNG, or WebP image.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  if (file.data.byteLength > IDENTITY_IMAGE_MAX_BYTES) {
    throw new AppError('Images must be 5 MB or smaller.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  return file
}

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

  const governmentId = assertIdentityImage(files.governmentId, 'government ID')
  const selfie = assertIdentityImage(files.selfie, 'selfie holding your ID')
  const identity = await findRentalIdentity(client, rental.uuid)

  if (!identity) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const admin = getSupabaseAdminClient()
  const governmentPath = `${userId}/rentals/${rental.uuid}/government-id.${identityImageExtension(governmentId.type || '')}`
  const selfiePath = `${userId}/rentals/${rental.uuid}/selfie-with-id.${identityImageExtension(selfie.type || '')}`

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

  const row = await upsertIdentityVerification(admin, {
    rental_id: identity.id,
    customer_id: profileId,
    government_id_path: governmentPath,
    selfie_path: selfiePath,
  })

  const submitted = toPublicRentalIdentity(row)
  await recordAudit(event, admin, {
    action: 'rental.identity.submit',
    entity: 'rental_identity_verifications',
    entityId: rental.uuid,
    next: {
      rentalUuid: rental.uuid,
      rentalCode: rental.code,
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
