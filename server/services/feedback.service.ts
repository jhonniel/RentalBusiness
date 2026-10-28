import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../../types/database.types'
import type { AdminFeedbackList, AdminFeedbackListItem, AdminRentalFeedback, FeedbackRewardSettingsResponse, PublicFeedbackForm, SentFeedbackLink } from '../../types/feedback'
import type { AdminFeedbackListQuery, SendFeedbackLinkInput, SubmitFeedbackInput } from '../../utils/feedback-validation'
import { EMAIL_TEMPLATES } from '../../utils/email'
import { feedbackRequestEmail, feedbackRewardEmail } from '../../utils/email-templates'
import { calendarDateInZone } from '../../utils/datetime'
import {
  FEEDBACK_REWARD_MIN_COMMENT,
  FEEDBACK_REWARD_SETTING_KEY,
  earnsFeedbackReward,
  feedbackRewardLabel,
  feedbackRewardStock,
  feedbackRewardUnavailableReason,
  readFeedbackRewardSettings,
  type FeedbackRewardSettingsInput,
  type FeedbackRewardVoucher,
} from '../../utils/feedback-reward'
import { findSettingByKey, upsertSetting } from '../repositories/setting.repository'
import { findVoucherByCode, insertVoucher, updateVoucherByUuid } from '../repositories/voucher.repository'
import { generateVoucherCode } from '../../utils/voucher'
import {
  averageFeedbackRating,
  buildFeedbackQuestions,
  canSendFeedback,
  feedbackExpiresAt,
  feedbackRequestStatus,
  feedbackUrl,
  isFeedbackExpired,
  matchFeedbackAnswers,
  summarizeFeedback,
} from '../../utils/feedback'
import {
  FEEDBACK_SETUP_MESSAGE,
  expireOpenFeedbackRequests,
  findFeedbackByUuid,
  countRewardsGiven,
  feedbackRewardReady,
  feedbackUniqueCodesReady,
  findRewardVoucherByUuid,
  findLatestFeedbackForRental,
  insertFeedbackRequest,
  listFeedbackRequests,
  listProductCategories,
  listRentalSummariesByIds,
  listRewardVouchersByIds,
  saveFeedbackSubmission,
  type RewardVoucherRow,
  type FeedbackRequestRow,
} from '../repositories/feedback.repository'
import { findRentalIdentity, findRentalIdentityById } from '../repositories/rental.repository'
import { findProfileById } from '../repositories/profile.repository'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import { isPlaceholderBookingEmail } from '../utils/placeholder-booking-email'
import { getSupabaseAdminClient } from '../utils/supabase'
import { createWaiverInviteToken, hashWaiverInviteToken, waiverInviteTokenMatches } from '../utils/waiver-invite-token'
import { sendTemplatedEmail } from './email.service'
import { getAdminRental } from './admin-rental.service'

type Client = SupabaseClient<Database>
type AdminRental = Awaited<ReturnType<typeof getAdminRental>>

const INVALID_LINK = 'This feedback link is invalid or has expired.'

function siteOrigin() {
  const config = useRuntimeConfig()
  return String(config.public.siteUrl || process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

async function accountEmail(userId: string) {
  const { data, error } = await getSupabaseAdminClient().auth.admin.getUserById(userId)
  return error || !data.user?.email ? null : data.user.email
}

function productNames(rental: AdminRental) {
  return [...new Set(rental.items.map(item => item.product.name))]
}

async function rentalQuestions(client: Client, rental: AdminRental) {
  const categories = await listProductCategories(client, rental.items.map(item => item.product.slug))
  return buildFeedbackQuestions(rental.items.map(item => ({
    slug: item.product.slug,
    name: item.product.name,
    categorySlug: categories.get(item.product.slug) ?? null,
  })))
}

function toAdminFeedback(rental: AdminRental, row: FeedbackRequestRow | null, ready: boolean, questions: AdminRentalFeedback['questions'], reward: FeedbackRewardVoucher | null = null): AdminRentalFeedback {
  const canSend = ready && canSendFeedback(rental.status) && !row?.submitted_at
  if (!row) {
    return {
      status: 'not_sent',
      canSend,
      ready,
      uuid: null,
      email: null,
      sentAt: null,
      expiresAt: null,
      submittedAt: null,
      averageRating: null,
      answers: [],
      comment: null,
      questions,
      reward: null,
      rewardEligible: true,
    }
  }

  const ratings = new Map((row.answers ?? []).map(answer => [answer.key, answer.rating]))
  return {
    status: row.submitted_at ? 'submitted' : isFeedbackExpired(row.expires_at) ? 'expired' : 'sent',
    canSend,
    ready,
    uuid: row.uuid,
    email: row.email,
    sentAt: row.created_at,
    expiresAt: row.expires_at,
    submittedAt: row.submitted_at,
    averageRating: row.average_rating === null ? null : Number(row.average_rating),
    answers: row.submitted_at ? row.questions.map(question => ({ ...question, rating: ratings.get(question.key) ?? 0 })) : [],
    comment: row.comment,
    questions: row.questions,
    reward,
    rewardEligible: row.reward_eligible !== false,
  }
}

export async function getAdminRentalFeedback(client: Client, identifier: string): Promise<AdminRentalFeedback> {
  const rental = await getAdminRental(client, identifier)
  const identity = await findRentalIdentity(client, rental.uuid)
  if (!identity) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const latest = await findLatestFeedbackForRental(client, identity.id)
  const questions = await rentalQuestions(client, rental)
  return latest === 'missing'
    ? toAdminFeedback(rental, null, false, questions)
    : toAdminFeedback(rental, latest, true, questions, latest ? await rewardForRow(client, latest) : null)
}

export async function sendFeedbackLink(
  event: H3Event,
  client: Client,
  profileId: number,
  identifier: string,
  input: SendFeedbackLinkInput,
): Promise<SentFeedbackLink> {
  const rental = await getAdminRental(client, identifier)
  if (!canSendFeedback(rental.status)) {
    throw new AppError('Send a feedback link after the booking is returned or done.', 409, ERROR_CODES.CONFLICT)
  }

  const identity = await findRentalIdentity(client, rental.uuid)
  const customer = identity ? await findProfileById(client, identity.customer_id) : null
  if (!identity || !customer) {
    throw new AppError('Rental not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const latest = await findLatestFeedbackForRental(client, identity.id)
  if (latest === 'missing') {
    throw new AppError(FEEDBACK_SETUP_MESSAGE, 409, ERROR_CODES.CONFLICT)
  }
  if (latest?.submitted_at) {
    throw new AppError('This customer already sent feedback for this booking.', 409, ERROR_CODES.CONFLICT)
  }

  const knownEmail = rental.customer?.email || await accountEmail(customer.user_id)
  const email = input.email?.trim() || (knownEmail && !isPlaceholderBookingEmail(knownEmail) ? knownEmail : null)

  await expireOpenFeedbackRequests(client, identity.id)
  const token = createWaiverInviteToken()
  const request = await insertFeedbackRequest(client, {
    rental_id: identity.id,
    token_hash: hashWaiverInviteToken(token),
    email,
    questions: await rentalQuestions(client, rental),
    expires_at: feedbackExpiresAt(),
    created_by: profileId,
    reward_eligible: input.earnsReward,
  })
  const link = feedbackUrl(siteOrigin(), request.uuid, token)

  let sent = false
  if (email) {
    try {
      const result = await sendTemplatedEmail(client, {
        to: email,
        template: EMAIL_TEMPLATES.RENTAL_FEEDBACK_REQUEST,
        entityKey: request.uuid,
        ...feedbackRequestEmail({
          customerName: customer.first_name || 'there',
          rentalCode: rental.code,
          products: productNames(rental),
          feedbackUrl: link,
        }),
      })
      sent = result?.status === 'sent'
    }
    catch {
      sent = false
    }
  }

  await recordAudit(event, client, {
    action: 'feedback.request.send',
    entity: 'rental_feedback_requests',
    entityId: request.uuid,
    next: { rentalCode: rental.code, email, sent, questions: request.questions.length, earnsReward: input.earnsReward },
  })

  return { uuid: request.uuid, expiresAt: request.expires_at, sent, feedbackUrl: link, earnsReward: input.earnsReward }
}

const rowStatus = feedbackRequestStatus

function rowAnswers(row: FeedbackRequestRow) {
  const ratings = new Map((row.answers ?? []).map(answer => [answer.key, answer.rating]))
  return row.submitted_at ? row.questions.map(question => ({ ...question, rating: ratings.get(question.key) ?? 0 })) : []
}

export async function listAdminFeedback(client: Client, query: AdminFeedbackListQuery): Promise<AdminFeedbackList> {
  const rows = await listFeedbackRequests(client)
  if (rows === 'missing') {
    return {
      ready: false,
      summary: summarizeFeedback([]),
      devices: [],
      items: [],
      page: 1,
      pageSize: query.pageSize,
      total: 0,
    }
  }

  const latestPerRental = new Map<number, FeedbackRequestRow>()
  for (const row of rows) {
    const current = latestPerRental.get(row.rental_id)
    if (!current || (!current.submitted_at && row.submitted_at)) {
      latestPerRental.set(row.rental_id, row)
    }
  }
  const current = [...latestPerRental.values()]
  const [rentals, vouchers] = await Promise.all([
    listRentalSummariesByIds(client, current.map(row => row.rental_id)),
    listRewardVouchersByIds(client, current.map(row => row.reward_voucher_id).filter((id): id is number => Boolean(id))),
  ])

  const all: AdminFeedbackListItem[] = current.map((row) => {
    const rental = rentals.get(row.rental_id)
    return {
      uuid: row.uuid,
      rentalUuid: rental?.uuid ?? '',
      rentalCode: rental?.code ?? '',
      customerName: rental?.customerName ?? 'Customer',
      products: [...new Set(row.questions.map(question => question.product).filter((name): name is string => Boolean(name)))],
      status: rowStatus(row),
      sentAt: row.created_at,
      submittedAt: row.submitted_at,
      averageRating: row.average_rating === null ? null : Number(row.average_rating),
      comment: row.comment,
      answers: rowAnswers(row),
      rewardCode: row.reward_voucher_id ? vouchers.get(row.reward_voucher_id)?.code ?? null : null,
    }
  })

  const search = query.search?.toLowerCase()
  const filtered = all
    .filter(item => query.status === 'all' || item.status === query.status)
    .filter(item => !query.device || item.products.includes(query.device))
    .filter(item => !query.rating || (item.averageRating !== null && Math.round(item.averageRating) === query.rating))
    .filter(item => !search || `${item.rentalCode} ${item.customerName} ${item.products.join(' ')} ${item.comment ?? ''}`.toLowerCase().includes(search))
    .sort((left, right) => (right.submittedAt ?? right.sentAt).localeCompare(left.submittedAt ?? left.sentAt))

  const from = (query.page - 1) * query.pageSize
  return {
    ready: true,
    summary: summarizeFeedback(all.filter(item => !query.device || item.products.includes(query.device))),
    devices: [...new Set(all.flatMap(item => item.products))].sort(),
    items: filtered.slice(from, from + query.pageSize),
    page: query.page,
    pageSize: query.pageSize,
    total: filtered.length,
  }
}

async function loadOpenRequest(client: Client, uuid: string, token: string) {
  const request = await findFeedbackByUuid(client, uuid)
  if (!request || !waiverInviteTokenMatches(request.token_hash, token)) {
    throw new AppError(INVALID_LINK, 404, ERROR_CODES.NOT_FOUND)
  }
  const identity = await findRentalIdentityById(client, request.rental_id)
  if (!identity) {
    throw new AppError(INVALID_LINK, 404, ERROR_CODES.NOT_FOUND)
  }
  return { request, identity }
}

function rewardVoucherView(voucher: { code: string, discount_type: 'percent' | 'fixed', discount_value: number, min_subtotal: number, ends_on: string | null } | undefined): FeedbackRewardVoucher | null {
  return voucher
    ? {
        code: voucher.code,
        label: feedbackRewardLabel({ discountType: voucher.discount_type, discountValue: voucher.discount_value }),
        minSubtotal: voucher.min_subtotal,
        endsOn: voucher.ends_on,
      }
    : null
}

async function rewardForRow(client: Client, row: FeedbackRequestRow) {
  if (!row.reward_voucher_id) {
    return null
  }
  const vouchers = await listRewardVouchersByIds(client, [row.reward_voucher_id])
  return rewardVoucherView(vouchers.get(row.reward_voucher_id))
}

async function loadRewardState(client: Client) {
  const [setting, rewardColumn, uniqueColumns] = await Promise.all([
    findSettingByKey(client, FEEDBACK_REWARD_SETTING_KEY).catch(() => null),
    feedbackRewardReady(client),
    feedbackUniqueCodesReady(client),
  ])
  const ready = rewardColumn && uniqueColumns
  const settings = readFeedbackRewardSettings(setting?.value)
  const voucher = ready && settings.voucherUuid ? await findRewardVoucherByUuid(client, settings.voucherUuid) : null
  const given = voucher ? await countRewardsGiven(client, voucher.id) : 0
  const reason = feedbackRewardUnavailableReason(voucher, given, calendarDateInZone())
  return {
    settings,
    ready,
    voucher,
    given,
    stock: voucher ? feedbackRewardStock(voucher, given) : null,
    open: ready && settings.enabled && !reason,
    reason,
  }
}

export async function getFeedbackRewardSettings(client: Client): Promise<FeedbackRewardSettingsResponse> {
  const state = await loadRewardState(client)
  return {
    enabled: state.settings.enabled,
    voucherUuid: state.settings.voucherUuid,
    ready: state.ready,
    voucher: state.voucher
      ? {
          uuid: state.voucher.uuid,
          code: state.voucher.code,
          name: state.voucher.name,
          label: feedbackRewardLabel({ discountType: state.voucher.discount_type, discountValue: state.voucher.discount_value }),
          status: state.voucher.status,
          endsOn: state.voucher.ends_on,
          maxRedemptions: state.voucher.max_redemptions,
          redeemedCount: state.voucher.redeemed_count,
        }
      : null,
    given: state.given,
    left: state.stock?.left ?? null,
    open: state.open,
    unavailableReason: state.settings.enabled ? state.reason : null,
  }
}

export async function saveFeedbackRewardSettings(event: H3Event, client: Client, input: FeedbackRewardSettingsInput) {
  const previous = await loadRewardState(client)
  if (input.enabled && !previous.ready) {
    throw new AppError('Paste the feedback reward SQL in Supabase before turning on the thank-you voucher.', 409, ERROR_CODES.CONFLICT)
  }
  if (input.voucherUuid && !await findRewardVoucherByUuid(client, input.voucherUuid)) {
    throw new AppError('That voucher was not found.', 404, ERROR_CODES.NOT_FOUND)
  }
  await upsertSetting(client, FEEDBACK_REWARD_SETTING_KEY, input as unknown as Json)
  await recordAudit(event, client, {
    action: 'feedback.reward.update',
    entity: 'settings',
    entityId: FEEDBACK_REWARD_SETTING_KEY,
    previous: previous.settings as unknown as Json,
    next: input as unknown as Json,
  })
  return getFeedbackRewardSettings(client)
}

async function createUniqueRewardCode(client: Client, template: RewardVoucherRow, rentalCode: string) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const created = await insertVoucher(client, {
        code: generateVoucherCode(),
        name: `Feedback · ${rentalCode} (from ${template.code})`,
        discount_type: template.discount_type,
        discount_value: template.discount_value,
        max_redemptions: 1,
        min_subtotal: template.min_subtotal,
        starts_on: calendarDateInZone(),
        ends_on: template.ends_on,
        status: 'active',
      })
      const row = await findVoucherByCode(client, created.code)
      return row ? { id: row.id, uuid: created.uuid, code: created.code } : null
    }
    catch (error) {
      if (!(error instanceof AppError && error.statusCode === 409)) {
        throw error
      }
    }
  }
  return null
}

export async function getPublicFeedback(client: Client, uuid: string, token: string): Promise<PublicFeedbackForm> {
  const { request, identity } = await loadOpenRequest(client, uuid, token)
  const [rental, reward] = await Promise.all([
    getAdminRental(client, identity.uuid),
    request.submitted_at || request.reward_eligible === false ? null : loadRewardState(client),
  ])
  return {
    rentalCode: rental.code,
    customerFirstName: rental.customer?.firstName || '',
    products: productNames(rental),
    startsOn: rental.startsOn,
    endsOn: rental.endsOn,
    questions: request.questions,
    submitted: Boolean(request.submitted_at),
    expired: !request.submitted_at && isFeedbackExpired(request.expires_at),
    rewardOffer: reward?.open && reward.voucher
      ? { label: feedbackRewardLabel({ discountType: reward.voucher.discount_type, discountValue: reward.voucher.discount_value }), minCommentLength: FEEDBACK_REWARD_MIN_COMMENT }
      : null,
    reward: request.submitted_at ? await rewardForRow(client, request) : null,
  }
}

export async function submitPublicFeedback(event: H3Event, client: Client, uuid: string, input: SubmitFeedbackInput) {
  const { request, identity } = await loadOpenRequest(client, uuid, input.token)
  if (request.submitted_at) {
    throw new AppError('Feedback for this booking was already sent. Thank you!', 409, ERROR_CODES.CONFLICT)
  }
  if (isFeedbackExpired(request.expires_at)) {
    throw new AppError(INVALID_LINK, 410, ERROR_CODES.NOT_FOUND)
  }

  const matched = matchFeedbackAnswers(request.questions, input.answers)
  if (!matched.complete) {
    throw new AppError('Rate every question from 1 to 5 stars.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  const comment = input.comment?.trim() || null
  const averageRating = averageFeedbackRating(matched.answers)
  const rewardState = await loadRewardState(client)
  const template = request.reward_eligible !== false && rewardState.open && rewardState.voucher && earnsFeedbackReward(rewardState.settings, comment)
    ? rewardState.voucher
    : null
  let voucher = template ? await createUniqueRewardCode(client, template, identity.code) : null

  const base = { answers: matched.answers, comment, average_rating: averageRating }
  let saved: FeedbackRequestRow
  try {
    saved = await saveFeedbackSubmission(client, uuid, voucher && template
      ? { ...base, reward_voucher_id: voucher.id, reward_source_voucher_id: template.id }
      : base)
  }
  catch (error) {
    if (voucher) {
      await updateVoucherByUuid(client, voucher.uuid, { status: 'disabled' }).catch(() => null)
    }
    const outOfCodes = error instanceof AppError && error.statusCode === 409 && /voucher codes have been given out/i.test(error.userMessage)
    if (!outOfCodes) {
      throw error
    }
    voucher = null
    saved = await saveFeedbackSubmission(client, uuid, base)
  }

  const reward = voucher ? await rewardForRow(client, saved) : null
  if (reward && request.email) {
    await sendTemplatedEmail(client, {
      to: request.email,
      template: EMAIL_TEMPLATES.FEEDBACK_REWARD,
      entityKey: saved.uuid,
      ...feedbackRewardEmail({ rentalCode: identity.code, ...reward }),
    }).catch(() => null)
  }

  await recordAudit(event, client, {
    action: 'feedback.submit',
    entity: 'rental_feedback_requests',
    entityId: saved.uuid,
    next: { averageRating, answers: matched.answers, hasComment: Boolean(comment), rewardVoucher: voucher?.uuid ?? null, rewardTemplate: voucher ? template?.uuid ?? null : null } as unknown as Json,
  })

  return { submitted: true, averageRating, reward }
}
