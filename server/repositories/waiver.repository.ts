import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

const VERSION_SELECT = 'id, uuid, version, title, body, is_current, published_at, created_at'
const ACCEPTANCE_SELECT = `
  uuid,
  signer_name,
  signer_email,
  signer_phone,
  accepted_at,
  privacy_policy_version,
  terms_version,
  waiver_versions (
    uuid,
    version,
    title,
    body
  )
`

export async function findCurrentWaiverVersion(client: Client) {
  const { data, error } = await client
    .from('waiver_versions')
    .select(VERSION_SELECT)
    .eq('is_current', true)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load the current waiver.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function findWaiverVersionByUuid(client: Client, uuid: string) {
  const { data, error } = await client
    .from('waiver_versions')
    .select(VERSION_SELECT)
    .eq('uuid', uuid)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that waiver.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function findWaiverAcceptanceByRentalId(client: Client, rentalId: number) {
  const { data, error } = await client
    .from('waiver_acceptances')
    .select(ACCEPTANCE_SELECT)
    .eq('rental_id', rentalId)
    .maybeSingle()

  if (error) {
    throw new AppError('We could not load that waiver acceptance.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data
}

export async function insertWaiverAcceptance(client: Client, values: Database['public']['Tables']['waiver_acceptances']['Insert']) {
  const { data, error } = await client
    .from('waiver_acceptances')
    .insert(values)
    .select(ACCEPTANCE_SELECT)
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      throw new AppError('This rental already has a signed waiver.', 409, ERROR_CODES.CONFLICT, { cause: error })
    }

    throw new AppError('We could not record that waiver acceptance.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function listWaiverVersions(client: Client) {
  const { data, error } = await client
    .from('waiver_versions')
    .select(VERSION_SELECT)
    .order('created_at', { ascending: false })

  if (error) {
    throw new AppError('We could not load waiver versions.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  return data ?? []
}

export async function unsetCurrentWaiverVersions(client: Client) {
  const { error } = await client
    .from('waiver_versions')
    .update({ is_current: false })
    .eq('is_current', true)

  if (error) {
    throw new AppError('We could not rotate the current waiver.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }
}

export async function insertWaiverVersion(client: Client, values: Database['public']['Tables']['waiver_versions']['Insert']) {
  const { data, error } = await client
    .from('waiver_versions')
    .insert(values)
    .select(VERSION_SELECT)
    .single()

  if (error || !data) {
    if (error?.code === '23505') {
      throw new AppError('That waiver version already exists.', 409, ERROR_CODES.CONFLICT, { cause: error })
    }

    throw new AppError('We could not publish that waiver.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  return data
}

export async function setWaiverVersionCurrent(client: Client, uuid: string, isCurrent: boolean) {
  const { error } = await client
    .from('waiver_versions')
    .update({ is_current: isCurrent })
    .eq('uuid', uuid)

  if (error) {
    throw new AppError('We could not restore the previous waiver.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }
}
