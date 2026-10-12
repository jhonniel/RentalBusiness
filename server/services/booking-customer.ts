import { randomBytes } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { findProfileByUserId, findProfileIdentity, findProfileIdentityByUuid, updateOwnProfile } from '../repositories/profile.repository'
import { isExistingAuthEmailError } from '../utils/auth-email-error'
import { createPlaceholderBookingEmail } from '../utils/placeholder-booking-email'
import { AppError, ERROR_CODES } from '../utils/errors'
import { getSupabaseAdminClient } from '../utils/supabase'

type Client = SupabaseClient<Database>

async function findOrCreateCustomerUser(email: string, firstName: string, lastName: string) {
  const admin = getSupabaseAdminClient()
  const created = await admin.auth.admin.createUser({
    email,
    password: `${randomBytes(24).toString('base64url')}Aa1!`,
    email_confirm: true,
    user_metadata: {
      first_name: firstName,
      last_name: lastName,
      full_name: `${firstName} ${lastName}`.trim(),
    },
  })

  if (!created.error && created.data.user) {
    return created.data.user.id
  }

  if (!isExistingAuthEmailError(created.error)) {
    throw new AppError(
      'We could not open an account for that client.',
      422,
      ERROR_CODES.VALIDATION_ERROR,
      { cause: created.error ?? undefined },
    )
  }

  const linked = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email,
  })
  if (linked.error || !linked.data.user) {
    throw new AppError(
      'An account with this email already exists, and we could not attach the booking.',
      409,
      ERROR_CODES.CONFLICT,
      { cause: linked.error ?? undefined },
    )
  }

  return linked.data.user.id
}

export async function ensureBookingCustomer(client: Client, input: {
  customerUuid?: string
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
}) {
  let userId: string

  if (input.customerUuid) {
    const existing = await findProfileIdentityByUuid(client, input.customerUuid)
    if (!existing) {
      throw new AppError('Customer not found.', 404, ERROR_CODES.NOT_FOUND)
    }
    if (existing.role !== 'customer') {
      throw new AppError('Choose a customer account for this booking.', 422, ERROR_CODES.VALIDATION_ERROR)
    }
    userId = existing.user_id
  }
  else {
    const email = input.email?.trim().toLowerCase() || createPlaceholderBookingEmail()
    userId = await findOrCreateCustomerUser(email, input.firstName?.trim() || '', input.lastName?.trim() || '')
  }

  const current = await findProfileByUserId(client, userId)
  await updateOwnProfile(client, userId, {
    firstName: input.firstName?.trim() || current?.first_name || '',
    lastName: input.lastName?.trim() || current?.last_name || '',
    phone: input.phone?.trim() || current?.phone || null,
  })

  const identity = await findProfileIdentity(client, userId)
  const profile = await findProfileByUserId(client, userId)
  if (!identity || !profile) {
    throw new AppError('We could not open that customer profile.', 500, ERROR_CODES.INTERNAL_ERROR)
  }
  if (profile.role !== 'customer') {
    throw new AppError('Choose a customer account for this booking.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  return identity.id
}
