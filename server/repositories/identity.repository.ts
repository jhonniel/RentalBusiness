import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

const IDENTITY_SELECT = 'uuid, rental_id, customer_id, government_id_path, selfie_path, submitted_at'

export async function findIdentityByRentalId(client: Client, rentalId: number) {
  const { data, error } = await client
    .from('rental_identity_verifications')
    .select(IDENTITY_SELECT)
    .eq('rental_id', rentalId)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that identity verification.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function upsertIdentityVerification(
  client: Client,
  values: Database['public']['Tables']['rental_identity_verifications']['Insert'],
) {
  const existing = await findIdentityByRentalId(client, values.rental_id)

  if (existing) {
    const { data, error } = await client
      .from('rental_identity_verifications')
      .update({
        government_id_path: values.government_id_path,
        selfie_path: values.selfie_path,
        submitted_at: new Date().toISOString(),
      })
      .eq('rental_id', values.rental_id)
      .select(IDENTITY_SELECT)
      .single()

    if (error || !data) {
      throw new AppError('We could not update those identity documents.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
    }

    return data
  }

  const { data, error } = await client
    .from('rental_identity_verifications')
    .insert(values)
    .select(IDENTITY_SELECT)
    .single()

  if (error || !data) {
    throw new AppError('We could not save those identity documents.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}
