import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../../types/database.types'
import type { AdminFaqListResponse, PublicFaq } from '../../types/faq'
import type { FaqInput } from '../../utils/faq-validation'
import { STARTER_FAQS, sortFaqs, toPublicFaq } from '../../utils/faq'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import {
  createFaq,
  deleteFaq,
  findFaqByUuid,
  listFaqs,
  updateFaq,
} from '../repositories/faq.repository'

type Client = SupabaseClient<Database>

export async function getPublicFaqs(client: Client): Promise<PublicFaq[]> {
  const rows = await listFaqs(client, true)
  return rows === null ? STARTER_FAQS : sortFaqs(rows.map(toPublicFaq))
}

export async function getAdminFaqs(client: Client): Promise<AdminFaqListResponse> {
  const rows = await listFaqs(client)
  return rows === null
    ? { items: STARTER_FAQS, ready: false }
    : { items: sortFaqs(rows.map(toPublicFaq)), ready: true }
}

export async function saveFaq(event: H3Event, client: Client, input: FaqInput, uuid?: string) {
  const previous = uuid ? await findFaqByUuid(client, uuid) : null
  if (uuid && !previous) {
    throw new AppError('FAQ not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const row = uuid ? await updateFaq(client, uuid, input) : await createFaq(client, input)
  const next = toPublicFaq(row)

  await recordAudit(event, client, {
    action: uuid ? 'faq.update' : 'faq.create',
    entity: 'faqs',
    entityId: next.uuid,
    previous: previous ? toPublicFaq(previous) as unknown as Json : undefined,
    next: next as unknown as Json,
  })

  return next
}

export async function removeFaq(event: H3Event, client: Client, uuid: string) {
  const previous = await findFaqByUuid(client, uuid)
  if (!previous) {
    throw new AppError('FAQ not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  await deleteFaq(client, uuid)
  await recordAudit(event, client, {
    action: 'faq.delete',
    entity: 'faqs',
    entityId: uuid,
    previous: toPublicFaq(previous) as unknown as Json,
  })

  return { uuid }
}
