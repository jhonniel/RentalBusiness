import { describe, expect, it } from 'vitest'
import {
  averageFeedbackRating,
  buildFeedbackQuestions,
  canSendFeedback,
  feedbackDeviceKind,
  feedbackExpiresAt,
  feedbackRequestStatus,
  feedbackUrl,
  isFeedbackExpired,
  matchFeedbackAnswers,
  summarizeFeedback,
} from '../../utils/feedback'
import { sendFeedbackLinkSchema, submitFeedbackSchema } from '../../utils/feedback-validation'

describe('rental feedback', () => {
  it('asks questions that match the rented device', () => {
    expect(feedbackDeviceKind({ slug: 'starlink-mini', name: 'Starlink Mini', categorySlug: 'starlink' })).toBe('starlink')
    expect(feedbackDeviceKind({ slug: 'dji-air-3', name: 'DJI Air 3', categorySlug: 'drones' })).toBe('drone')
    expect(feedbackDeviceKind({ slug: 'dji-osmo-360', name: 'DJI OSMO 360' })).toBe('camera')
    expect(feedbackDeviceKind({ slug: 'jbl-partybox-encore-essential-2', name: 'JBL Partybox Encore Essential 2' })).toBe('audio')
    expect(feedbackDeviceKind({ slug: 'tripod', name: 'Tripod', categorySlug: 'accessories' })).toBe('device')

    const questions = buildFeedbackQuestions([{ slug: 'starlink-mini', name: 'Starlink Mini', categorySlug: 'starlink' }])
    expect(questions.filter(question => question.product === 'Starlink Mini').map(question => question.text)).toContain('How fast and stable was the internet connection?')
    expect(questions.filter(question => question.product === null).length).toBe(3)
    expect(questions.map(question => question.text)).not.toContain('How clean and well kept was the equipment when you got it?')
    expect(questions.map(question => question.text)).not.toContain('How well did the power supply and accessories work?')
    expect(new Set(questions.map(question => question.key)).size).toBe(questions.length)
  })

  it('groups each device once and keeps the list short', () => {
    const questions = buildFeedbackQuestions([
      { slug: 'starlink-mini', name: 'Starlink Mini' },
      { slug: 'starlink-mini', name: 'Starlink Mini' },
      { slug: 'dji-air-3', name: 'DJI Air 3' },
    ])
    expect(questions.filter(question => question.product === 'Starlink Mini')).toHaveLength(2)
    expect(questions.filter(question => question.product === 'DJI Air 3').map(question => question.key)).toContain('dji-air-3:flight')
  })

  it('opens only after the booking is returned or done', () => {
    expect(canSendFeedback('completed')).toBe(true)
    expect(canSendFeedback('returned')).toBe(true)
    expect(canSendFeedback('active')).toBe(false)
    expect(canSendFeedback('cancelled')).toBe(false)
  })

  it('requires a 1 to 5 star rating for every question and averages them', () => {
    const questions = buildFeedbackQuestions([{ slug: 'starlink-mini', name: 'Starlink Mini' }])
    const all = questions.map(question => ({ key: question.key, rating: 4 }))
    expect(matchFeedbackAnswers(questions, all).complete).toBe(true)
    expect(matchFeedbackAnswers(questions, all.slice(1)).complete).toBe(false)
    expect(matchFeedbackAnswers(questions, [...all, { key: 'other:x', rating: 5 }]).complete).toBe(false)
    expect(averageFeedbackRating([{ key: 'a', rating: 5 }, { key: 'b', rating: 4 }, { key: 'c', rating: 4 }])).toBe(4.33)

    const token = 'x'.repeat(43)
    expect(submitFeedbackSchema.safeParse({ token, answers: [{ key: 'a', rating: 6 }] }).success).toBe(false)
    expect(submitFeedbackSchema.safeParse({ token, answers: [{ key: 'a', rating: 0 }] }).success).toBe(false)
    expect(submitFeedbackSchema.safeParse({ token, answers: [{ key: 'a', rating: 5 }], comment: 'Great!' }).success).toBe(true)
    expect(submitFeedbackSchema.safeParse({ token, answers: [{ key: 'a', rating: 5 }], comment: 'x'.repeat(2001) }).success).toBe(false)
    expect(sendFeedbackLinkSchema.safeParse({ email: 'not-an-email' }).success).toBe(false)
    expect(sendFeedbackLinkSchema.parse({}).earnsReward).toBe(true)
    expect(sendFeedbackLinkSchema.parse({ earnsReward: false }).earnsReward).toBe(false)
  })

  it('summarizes answered feedback overall and per device for the admin list', () => {
    const starlink = (rating: number) => ({ key: 'starlink-mini:setup', text: 'Setup', product: 'Starlink Mini', rating })
    const general = (rating: number) => ({ key: 'general:service', text: 'Service', product: null, rating })
    const summary = summarizeFeedback([
      { status: 'submitted', averageRating: 4.5, answers: [starlink(5), general(4)] },
      { status: 'submitted', averageRating: 3, answers: [starlink(3), general(3)] },
      { status: 'sent', averageRating: null, answers: [] },
      { status: 'expired', averageRating: null, answers: [] },
    ])
    expect(summary.responses).toBe(2)
    expect(summary.averageRating).toBe(3.75)
    expect(summary.waiting).toBe(1)
    expect(summary.expired).toBe(1)
    expect(summary.responseRate).toBe(50)
    expect(summary.stars).toEqual({ 1: 0, 2: 0, 3: 1, 4: 0, 5: 1 })
    expect(summary.devices).toEqual([
      { name: 'Starlink Mini', responses: 2, averageRating: 4 },
      { name: 'Overall experience', responses: 2, averageRating: 3.5 },
    ])
    expect(summarizeFeedback([]).averageRating).toBeNull()
  })

  it('tells answered, waiting, and expired links apart', () => {
    const now = new Date('2026-10-28T00:00:00Z')
    expect(feedbackRequestStatus({ submitted_at: '2026-10-27T00:00:00Z', expires_at: '2026-10-01T00:00:00Z' }, now)).toBe('submitted')
    expect(feedbackRequestStatus({ submitted_at: null, expires_at: '2026-11-01T00:00:00Z' }, now)).toBe('sent')
    expect(feedbackRequestStatus({ submitted_at: null, expires_at: '2026-10-27T00:00:00Z' }, now)).toBe('expired')
  })

  it('builds a public link by uuid and token and expires after 30 days', () => {
    expect(feedbackUrl('https://jryrentals.com/', '11111111-1111-4111-8111-111111111111', 'a b')).toBe('https://jryrentals.com/feedback/11111111-1111-4111-8111-111111111111?token=a%20b')
    const now = new Date('2026-10-28T00:00:00Z')
    const expires = feedbackExpiresAt(now)
    expect(isFeedbackExpired(expires, new Date('2026-11-26T23:00:00Z'))).toBe(false)
    expect(isFeedbackExpired(expires, new Date('2026-11-27T00:00:01Z'))).toBe(true)
  })
})
