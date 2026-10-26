import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { FaqRow } from '../../utils/faq'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

const FAQ_SELECT = 'uuid, question, answer, sort_order, is_active, updated_at'

export const FAQ_SETUP_MESSAGE = 'Paste the FAQs SQL in Supabase to turn on FAQs.'

function table(client: Client) {
  return (client as unknown as SupabaseClient).from('faqs')
}

export function isMissingFaqTable(error: { code?: string } | null) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

function failure(message: string, error: { code?: string } | null): never {
  if (isMissingFaqTable(error)) {
    throw new AppError(FAQ_SETUP_MESSAGE, 409, ERROR_CODES.CONFLICT, { cause: error })
  }
  throw new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
}

export async function listFaqs(client: Client, activeOnly = false): Promise<FaqRow[] | null> {
  let query = table(client)
    .select(FAQ_SELECT)
    .order('sort_order')
    .order('created_at')
    .limit(200)
  if (activeOnly) {
    query = query.eq('is_active', true)
  }

  const { data, error } = await query
  if (isMissingFaqTable(error)) {
    return null
  }
  if (error) {
    throw new AppError('We could not load the FAQs.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }
  return (data ?? []) as unknown as FaqRow[]
}

export async function findFaqByUuid(client: Client, uuid: string): Promise<FaqRow | null> {
  const { data, error } = await table(client).select(FAQ_SELECT).eq('uuid', uuid).maybeSingle()
  if (error) {
    failure('We could not load that FAQ.', error)
  }
  return (data as unknown as FaqRow | null) ?? null
}

export async function createFaq(client: Client, input: { question: string, answer: string, sortOrder: number, isActive: boolean }) {
  const { data, error } = await table(client)
    .insert({
      question: input.question,
      answer: input.answer,
      sort_order: input.sortOrder,
      is_active: input.isActive,
    })
    .select(FAQ_SELECT)
    .single()
  if (error || !data) {
    failure('We could not add that FAQ.', error)
  }
  return data as unknown as FaqRow
}

export async function updateFaq(client: Client, uuid: string, input: { question: string, answer: string, sortOrder: number, isActive: boolean }) {
  const { data, error } = await table(client)
    .update({
      question: input.question,
      answer: input.answer,
      sort_order: input.sortOrder,
      is_active: input.isActive,
    })
    .eq('uuid', uuid)
    .select(FAQ_SELECT)
    .maybeSingle()
  if (error) {
    failure('We could not update that FAQ.', error)
  }
  if (!data) {
    throw new AppError('FAQ not found.', 404, ERROR_CODES.NOT_FOUND)
  }
  return data as unknown as FaqRow
}

export async function deleteFaq(client: Client, uuid: string) {
  const { error } = await table(client).delete().eq('uuid', uuid)
  if (error) {
    failure('We could not delete that FAQ.', error)
  }
}
