import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

function profiles(client: Client) {
  return (client as unknown as SupabaseClient).from('profiles')
}

function isMissingColumn(error: { code?: string } | null) {
  return error?.code === '42703' || error?.code === 'PGRST204'
}

export interface LinkedCommissioner {
  id: number
  uuid: string
  first_name: string
  last_name: string
}

export async function listLinkedCommissioners(client: Client, customerUuids: string[]) {
  const linked = new Map<string, LinkedCommissioner>()
  if (!customerUuids.length) {
    return { linked, available: true }
  }

  const { data, error } = await profiles(client)
    .select('uuid, assigned_commissioner_id')
    .in('uuid', customerUuids)
    .not('assigned_commissioner_id', 'is', null)
  if (error) {
    if (isMissingColumn(error)) {
      return { linked, available: false }
    }
    throw new AppError('We could not load linked commissioners.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }

  const rows = (data ?? []) as Array<{ uuid: string, assigned_commissioner_id: number }>
  const ids = [...new Set(rows.map(row => row.assigned_commissioner_id))]
  if (!ids.length) {
    return { linked, available: true }
  }

  const { data: people, error: peopleError } = await profiles(client)
    .select('id, uuid, first_name, last_name')
    .in('id', ids)
    .eq('role', 'commissioner')
  if (peopleError) {
    throw new AppError('We could not load linked commissioners.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: peopleError })
  }

  const byId = new Map(((people ?? []) as LinkedCommissioner[]).map(person => [person.id, person]))
  for (const row of rows) {
    const person = byId.get(row.assigned_commissioner_id)
    if (person) {
      linked.set(row.uuid, person)
    }
  }
  return { linked, available: true }
}

export async function findLinkedCommissionerUuid(client: Client, customerProfileId: number) {
  const { data, error } = await profiles(client)
    .select('assigned_commissioner_id')
    .eq('id', customerProfileId)
    .maybeSingle()
  if (error || !data?.assigned_commissioner_id) {
    return null
  }

  const { data: person } = await profiles(client)
    .select('uuid, role')
    .eq('id', data.assigned_commissioner_id)
    .maybeSingle()
  return person?.role === 'commissioner' ? person.uuid as string : null
}

export async function setLinkedCommissioner(client: Client, customerUuid: string, values: {
  commissionerId: number | null
  linkedBy: number
}) {
  const { error } = await profiles(client)
    .update({
      assigned_commissioner_id: values.commissionerId,
      assigned_commissioner_at: values.commissionerId ? new Date().toISOString() : null,
      assigned_commissioner_by: values.commissionerId ? values.linkedBy : null,
    })
    .eq('uuid', customerUuid)
    .eq('role', 'customer')

  if (error) {
    if (isMissingColumn(error)) {
      throw new AppError('Paste the customer commissioner SQL in Supabase to link customers to commissioners.', 409, ERROR_CODES.CONFLICT, { cause: error })
    }
    throw new AppError('We could not link that commissioner.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }
}
