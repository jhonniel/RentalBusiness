import type { RentalStatus } from './constants'

export const FEEDBACK_LINK_DAYS = 30
export const FEEDBACK_RATING_MIN = 1
export const FEEDBACK_RATING_MAX = 5
export const FEEDBACK_MAX_DEVICES = 3

export const FEEDBACK_RENTAL_STATUSES: readonly RentalStatus[] = ['returned', 'completed']

export interface FeedbackQuestion {
  key: string
  text: string
  product: string | null
}

export interface FeedbackAnswer {
  key: string
  rating: number
}

export interface FeedbackDevice {
  slug: string
  name: string
  categorySlug?: string | null
}

export type FeedbackDeviceKind = 'starlink' | 'drone' | 'camera' | 'audio' | 'lighting' | 'device'

const DEVICE_QUESTIONS: Record<FeedbackDeviceKind, Array<[string, string]>> = {
  starlink: [
    ['setup', 'How easy was it to set up and connect?'],
    ['connection', 'How fast and stable was the internet connection?'],
  ],
  drone: [
    ['flight', 'How stable and responsive was the drone in flight?'],
    ['battery', 'How well did the batteries last for your needs?'],
    ['camera', 'How happy were you with the photo and video quality?'],
  ],
  camera: [
    ['quality', 'How happy were you with the photo and video quality?'],
    ['battery', 'How well did the battery last for your needs?'],
    ['ease', 'How easy was it to use?'],
  ],
  audio: [
    ['sound', 'How was the sound quality and volume?'],
    ['battery', 'How well did the battery last for your event?'],
    ['connection', 'How well did Bluetooth and the connections work?'],
  ],
  lighting: [
    ['brightness', 'How was the brightness and light quality?'],
    ['battery', 'How well did the power or battery last?'],
    ['ease', 'How easy was it to set up and use?'],
  ],
  device: [
    ['works', 'How well did the equipment work?'],
    ['ease', 'How easy was it to use?'],
    ['complete', 'Were all the accessories you needed included?'],
  ],
}

export const GENERAL_FEEDBACK_QUESTIONS: Array<[string, string]> = [
  ['handover', 'How smooth was the pickup, meetup, or delivery and the return?'],
  ['service', 'How helpful was the JRY Rentals team?'],
  ['value', 'How would you rate the value for the price?'],
]

export function feedbackDeviceKind(device: FeedbackDevice): FeedbackDeviceKind {
  const category = (device.categorySlug || '').toLowerCase()
  const hay = `${device.name} ${device.slug}`.toLowerCase()
  if (category === 'starlink' || /starlink/.test(hay)) {
    return 'starlink'
  }
  if (category === 'drones' || /\bdrone|\bair[ -]?\d|\bmavic|\bmini[ -]?\d|\bavata/.test(hay)) {
    return 'drone'
  }
  if (category === 'audio' || /\bjbl|speaker|partybox|\bmic|audio/.test(hay)) {
    return 'audio'
  }
  if (category === 'lighting' || /\blight|\bled\b/.test(hay)) {
    return 'lighting'
  }
  if (category === 'cameras' || category === 'lenses' || /camera|\bosmo|gopro|insta360|\b360\b|lens/.test(hay)) {
    return 'camera'
  }
  return 'device'
}

export function buildFeedbackQuestions(devices: FeedbackDevice[]): FeedbackQuestion[] {
  const unique = devices.filter((device, index) => devices.findIndex(item => item.slug === device.slug) === index)
  const deviceQuestions = unique.slice(0, FEEDBACK_MAX_DEVICES).flatMap(device =>
    DEVICE_QUESTIONS[feedbackDeviceKind(device)].map(([key, text]) => ({
      key: `${device.slug}:${key}`,
      text,
      product: device.name,
    })),
  )
  const general = GENERAL_FEEDBACK_QUESTIONS.map(([key, text]) => ({ key: `general:${key}`, text, product: null }))
  return [...deviceQuestions, ...general]
}

export function canSendFeedback(status: RentalStatus) {
  return FEEDBACK_RENTAL_STATUSES.includes(status)
}

export function feedbackExpiresAt(now = new Date()) {
  return new Date(now.getTime() + FEEDBACK_LINK_DAYS * 24 * 60 * 60 * 1000).toISOString()
}

export function isFeedbackExpired(expiresAt: string, now = new Date()) {
  return new Date(expiresAt).getTime() <= now.getTime()
}

export function feedbackRequestStatus(row: { submitted_at: string | null, expires_at: string }, now = new Date()): 'sent' | 'expired' | 'submitted' {
  return row.submitted_at ? 'submitted' : isFeedbackExpired(row.expires_at, now) ? 'expired' : 'sent'
}

export function averageFeedbackRating(answers: FeedbackAnswer[]) {
  if (!answers.length) {
    return 0
  }
  const total = answers.reduce((sum, answer) => sum + answer.rating, 0)
  return Math.round((total / answers.length) * 100) / 100
}

export function matchFeedbackAnswers(questions: FeedbackQuestion[], answers: FeedbackAnswer[]) {
  const ratings = new Map(answers.map(answer => [answer.key, answer.rating]))
  const missing = questions.filter(question => !ratings.has(question.key))
  const extra = answers.filter(answer => !questions.some(question => question.key === answer.key))
  return {
    complete: missing.length === 0 && extra.length === 0,
    answers: questions.map(question => ({ key: question.key, rating: ratings.get(question.key) ?? 0 })),
  }
}

export interface FeedbackSummaryInput {
  status: 'not_sent' | 'sent' | 'expired' | 'submitted'
  averageRating: number | null
  answers: Array<FeedbackQuestion & { rating: number }>
}

export const OVERALL_EXPERIENCE = 'Overall experience'

export function summarizeFeedback(items: FeedbackSummaryInput[]) {
  const submitted = items.filter(item => item.status === 'submitted' && item.averageRating !== null)
  const stars = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } as Record<1 | 2 | 3 | 4 | 5, number>
  for (const item of submitted) {
    const bucket = Math.min(5, Math.max(1, Math.round(item.averageRating!))) as 1 | 2 | 3 | 4 | 5
    stars[bucket] += 1
  }

  const devices = new Map<string, { total: number, count: number, responses: number }>()
  for (const item of submitted) {
    const seen = new Set<string>()
    for (const answer of item.answers) {
      const name = answer.product ?? OVERALL_EXPERIENCE
      const entry = devices.get(name) ?? { total: 0, count: 0, responses: 0 }
      entry.total += answer.rating
      entry.count += 1
      if (!seen.has(name)) {
        entry.responses += 1
        seen.add(name)
      }
      devices.set(name, entry)
    }
  }

  const waiting = items.filter(item => item.status === 'sent').length
  const expired = items.filter(item => item.status === 'expired').length
  const asked = submitted.length + waiting + expired
  return {
    responses: submitted.length,
    averageRating: submitted.length ? averageFeedbackRating(submitted.map(item => ({ key: '', rating: item.averageRating! }))) : null,
    waiting,
    expired,
    responseRate: asked ? Math.round((submitted.length / asked) * 100) : null,
    stars,
    devices: [...devices.entries()]
      .map(([name, entry]) => ({ name, responses: entry.responses, averageRating: Math.round((entry.total / entry.count) * 100) / 100 }))
      .sort((left, right) => (left.name === OVERALL_EXPERIENCE ? 1 : 0) - (right.name === OVERALL_EXPERIENCE ? 1 : 0) || right.responses - left.responses),
  }
}

export function feedbackPath(uuid: string, token: string) {
  return `/feedback/${uuid}?token=${encodeURIComponent(token)}`
}

export function feedbackUrl(origin: string, uuid: string, token: string) {
  return `${origin.replace(/\/$/, '')}${feedbackPath(uuid, token)}`
}

export const FEEDBACK_RATING_LABELS: Record<number, string> = {
  1: 'Poor',
  2: 'Fair',
  3: 'Good',
  4: 'Very good',
  5: 'Excellent',
}
