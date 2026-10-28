import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { FeedbackAnswer, FeedbackQuestion } from '../../utils/feedback'
import { AppError, ERROR_CODES } from '../utils/errors'

type Client = SupabaseClient<Database>

export const FEEDBACK_SETUP_MESSAGE = 'Paste the rental feedback SQL in Supabase to turn on feedback links.'

const BASE_SELECT = 'uuid, rental_id, token_hash, email, questions, expires_at, created_at, submitted_at, answers, comment, average_rating'
const REWARD_SELECT = `${BASE_SELECT}, reward_voucher_id`
const FEEDBACK_SELECT = `${REWARD_SELECT}, reward_eligible, reward_source_voucher_id`
const SELECT_FALLBACKS = [FEEDBACK_SELECT, REWARD_SELECT, BASE_SELECT]

function isMissingColumn(error: { code?: string } | null) {
  return error?.code === '42703' || error?.code === 'PGRST204'
}

async function withRewardFallback<T>(run: (select: string) => PromiseLike<{ data: T, error: { code?: string, message?: string } | null }>) {
  let result = await run(SELECT_FALLBACKS[0]!)
  for (const select of SELECT_FALLBACKS.slice(1)) {
    if (!isMissingColumn(result.error)) {
      break
    }
    result = await run(select)
  }
  return result
}

export interface FeedbackRequestRow {
  uuid: string
  rental_id: number
  token_hash: string
  email: string | null
  questions: FeedbackQuestion[]
  expires_at: string
  created_at: string
  submitted_at: string | null
  answers: FeedbackAnswer[] | null
  comment: string | null
  average_rating: number | string | null
  reward_voucher_id?: number | null
  reward_eligible?: boolean
  reward_source_voucher_id?: number | null
}

function table(client: Client) {
  return (client as unknown as SupabaseClient).from('rental_feedback_requests')
}

export function isMissingFeedbackTable(error: { code?: string } | null) {
  return error?.code === '42P01' || error?.code === 'PGRST205'
}

function failure(message: string, error: { code?: string } | null): never {
  if (isMissingFeedbackTable(error)) {
    throw new AppError(FEEDBACK_SETUP_MESSAGE, 409, ERROR_CODES.CONFLICT, { cause: error })
  }
  throw new AppError(message, 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
}

export async function findLatestFeedbackForRental(client: Client, rentalId: number): Promise<FeedbackRequestRow | null | 'missing'> {
  const { data, error } = await withRewardFallback(select => table(client)
    .select(select)
    .eq('rental_id', rentalId)
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle())
  if (isMissingFeedbackTable(error)) {
    return 'missing'
  }
  if (error) {
    throw new AppError('We could not load the feedback for that rental.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }
  return (data as unknown as FeedbackRequestRow | null) ?? null
}

export async function listFeedbackRequests(client: Client, limit = 1000): Promise<FeedbackRequestRow[] | 'missing'> {
  const { data, error } = await withRewardFallback(select => table(client)
    .select(select)
    .order('created_at', { ascending: false })
    .limit(limit))
  if (isMissingFeedbackTable(error)) {
    return 'missing'
  }
  if (error) {
    throw new AppError('We could not load feedback.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }
  return (data ?? []) as unknown as FeedbackRequestRow[]
}

export async function listLatestFeedbackByRentalIds(client: Client, rentalIds: number[]) {
  const latest = new Map<number, FeedbackRequestRow>()
  if (!rentalIds.length) {
    return latest
  }
  const { data, error } = await withRewardFallback(select => table(client)
    .select(select)
    .in('rental_id', rentalIds)
    .order('created_at', { ascending: false }))
  if (error) {
    return latest
  }
  for (const row of (data ?? []) as unknown as FeedbackRequestRow[]) {
    const current = latest.get(row.rental_id)
    if (!current || (!current.submitted_at && row.submitted_at)) {
      latest.set(row.rental_id, row)
    }
  }
  return latest
}

export async function listRentalSummariesByIds(client: Client, rentalIds: number[]) {
  const summaries = new Map<number, { uuid: string, code: string, customerName: string }>()
  if (!rentalIds.length) {
    return summaries
  }
  const { data: rentals, error } = await (client as unknown as SupabaseClient)
    .from('rental_requests')
    .select('id, uuid, code, customer_id')
    .in('id', rentalIds)
  if (error || !rentals) {
    return summaries
  }
  const customerIds = [...new Set(rentals.map(row => row.customer_id).filter(Boolean))]
  const { data: profiles } = customerIds.length
    ? await (client as unknown as SupabaseClient).from('profiles').select('id, first_name, last_name').in('id', customerIds)
    : { data: [] }
  const names = new Map((profiles ?? []).map(row => [row.id, [row.first_name, row.last_name].filter(Boolean).join(' ').trim()]))
  for (const row of rentals) {
    summaries.set(row.id, { uuid: row.uuid, code: row.code, customerName: names.get(row.customer_id) || 'Customer' })
  }
  return summaries
}

export async function findFeedbackByUuid(client: Client, uuid: string): Promise<FeedbackRequestRow | null> {
  const { data, error } = await withRewardFallback(select => table(client).select(select).eq('uuid', uuid).maybeSingle())
  if (isMissingFeedbackTable(error)) {
    return null
  }
  if (error) {
    throw new AppError('We could not load that feedback link.', 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
  }
  return (data as unknown as FeedbackRequestRow | null) ?? null
}

export async function expireOpenFeedbackRequests(client: Client, rentalId: number) {
  const { error } = await table(client)
    .update({ expires_at: new Date().toISOString() })
    .eq('rental_id', rentalId)
    .is('submitted_at', null)
  if (error) {
    failure('We could not replace the previous feedback link.', error)
  }
}

export async function insertFeedbackRequest(client: Client, values: {
  rental_id: number
  token_hash: string
  email: string | null
  questions: FeedbackQuestion[]
  expires_at: string
  created_by: number
  reward_eligible: boolean
}) {
  const { reward_eligible: rewardEligible, ...base } = values
  const { data, error } = await withRewardFallback(select => table(client)
    .insert(rewardEligible ? base : values)
    .select(select)
    .single())
  if (!rewardEligible && isMissingColumn(error)) {
    throw new AppError('Paste the feedback reward choice SQL in Supabase to send a link without the voucher.', 409, ERROR_CODES.CONFLICT, { cause: error })
  }
  if (error?.code === '23505' && /already sent feedback/i.test(error.message ?? '')) {
    throw new AppError('This customer already sent feedback for this booking.', 409, ERROR_CODES.CONFLICT, { cause: error })
  }
  if (error || !data) {
    failure('We could not create that feedback link.', error)
  }
  return data as unknown as FeedbackRequestRow
}

export async function saveFeedbackSubmission(client: Client, uuid: string, values: {
  answers: FeedbackAnswer[]
  comment: string | null
  average_rating: number
  reward_voucher_id?: number | null
  reward_source_voucher_id?: number | null
}) {
  const { data, error } = await table(client)
    .update({ ...values, submitted_at: new Date().toISOString() })
    .eq('uuid', uuid)
    .is('submitted_at', null)
    .select(values.reward_source_voucher_id ? FEEDBACK_SELECT : values.reward_voucher_id ? REWARD_SELECT : BASE_SELECT)
    .maybeSingle()
  if (error) {
    if (error.code === 'P0001' && /voucher codes have been given out/i.test(error.message ?? '')) {
      throw new AppError('All feedback voucher codes have been given out.', 409, ERROR_CODES.CONFLICT, { cause: error })
    }
    if (error.code === '23505' || error.code === '23514') {
      throw new AppError('Feedback for this booking was already sent. Thank you!', 409, ERROR_CODES.CONFLICT, { cause: error })
    }
    failure('We could not save your feedback.', error)
  }
  if (!data) {
    throw new AppError('Feedback for this booking was already sent. Thank you!', 409, ERROR_CODES.CONFLICT)
  }
  return data as unknown as FeedbackRequestRow
}

export async function listProductCategories(client: Client, slugs: string[]) {
  if (!slugs.length) {
    return new Map<string, string>()
  }
  const { data, error } = await (client as unknown as SupabaseClient)
    .from('products')
    .select('slug, product_categories ( slug )')
    .in('slug', slugs)
  if (error) {
    return new Map<string, string>()
  }
  const rows = (data ?? []) as unknown as Array<{ slug: string, product_categories: { slug: string } | Array<{ slug: string }> | null }>
  return new Map(rows.map((row) => {
    const category = Array.isArray(row.product_categories) ? row.product_categories[0] : row.product_categories
    return [row.slug, category?.slug ?? ''] as const
  }))
}

export async function feedbackRewardReady(client: Client) {
  const { error } = await table(client).select('reward_voucher_id').limit(1)
  return !error
}

export async function listRewardVouchersByIds(client: Client, ids: number[]) {
  const vouchers = new Map<number, { code: string, discount_type: 'percent' | 'fixed', discount_value: number, min_subtotal: number, ends_on: string | null }>()
  if (!ids.length) {
    return vouchers
  }
  const { data, error } = await (client as unknown as SupabaseClient)
    .from('vouchers')
    .select('id, code, discount_type, discount_value, min_subtotal, ends_on')
    .in('id', ids)
  if (error) {
    return vouchers
  }
  for (const row of data ?? []) {
    vouchers.set(row.id, { code: row.code, discount_type: row.discount_type, discount_value: Number(row.discount_value), min_subtotal: Number(row.min_subtotal), ends_on: row.ends_on })
  }
  return vouchers
}

export interface RewardVoucherRow {
  id: number
  uuid: string
  code: string
  name: string
  status: 'draft' | 'active' | 'disabled'
  discount_type: 'percent' | 'fixed'
  discount_value: number
  max_redemptions: number | null
  redeemed_count: number
  min_subtotal: number
  starts_on: string | null
  ends_on: string | null
}

export async function findRewardVoucherByUuid(client: Client, uuid: string): Promise<RewardVoucherRow | null> {
  const { data, error } = await (client as unknown as SupabaseClient)
    .from('vouchers')
    .select('id, uuid, code, name, status, discount_type, discount_value, max_redemptions, redeemed_count, min_subtotal, starts_on, ends_on')
    .eq('uuid', uuid)
    .maybeSingle()
  if (error || !data) {
    return null
  }
  return { ...data, discount_value: Number(data.discount_value), min_subtotal: Number(data.min_subtotal) } as RewardVoucherRow
}

export async function countRewardsGiven(client: Client, templateVoucherId: number) {
  const { count, error } = await table(client)
    .select('uuid', { count: 'exact', head: true })
    .eq('reward_source_voucher_id', templateVoucherId)
  return error ? 0 : count ?? 0
}

export async function feedbackUniqueCodesReady(client: Client) {
  const { error } = await table(client).select('reward_source_voucher_id, reward_eligible').limit(1)
  return !error
}
