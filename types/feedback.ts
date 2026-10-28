import type { FeedbackQuestion } from '~/utils/feedback'
import type { FeedbackRewardOffer, FeedbackRewardVoucher } from '~/utils/feedback-reward'

export type RentalFeedbackStatus = 'not_sent' | 'sent' | 'expired' | 'submitted'

export interface RentalFeedbackAnswer extends FeedbackQuestion {
  rating: number
}

export interface AdminRentalFeedback {
  status: RentalFeedbackStatus
  canSend: boolean
  ready: boolean
  uuid: string | null
  email: string | null
  sentAt: string | null
  expiresAt: string | null
  submittedAt: string | null
  averageRating: number | null
  answers: RentalFeedbackAnswer[]
  comment: string | null
  questions: FeedbackQuestion[]
  reward: FeedbackRewardVoucher | null
  rewardEligible: boolean
}

export interface RentalFeedbackSummary {
  status: RentalFeedbackStatus
  averageRating: number | null
}

export interface AdminFeedbackListItem {
  uuid: string
  rentalUuid: string
  rentalCode: string
  customerName: string
  products: string[]
  status: RentalFeedbackStatus
  sentAt: string
  submittedAt: string | null
  averageRating: number | null
  comment: string | null
  answers: RentalFeedbackAnswer[]
  rewardCode: string | null
}

export interface AdminFeedbackDeviceSummary {
  name: string
  responses: number
  averageRating: number
}

export interface AdminFeedbackList {
  ready: boolean
  summary: {
    responses: number
    averageRating: number | null
    waiting: number
    expired: number
    responseRate: number | null
    stars: Record<1 | 2 | 3 | 4 | 5, number>
    devices: AdminFeedbackDeviceSummary[]
  }
  devices: string[]
  items: AdminFeedbackListItem[]
  page: number
  pageSize: number
  total: number
}

export interface SentFeedbackLink {
  uuid: string
  expiresAt: string
  sent: boolean
  feedbackUrl: string
  earnsReward: boolean
}

export interface PublicFeedbackForm {
  rentalCode: string
  customerFirstName: string
  products: string[]
  startsOn: string
  endsOn: string
  questions: FeedbackQuestion[]
  submitted: boolean
  expired: boolean
  rewardOffer: FeedbackRewardOffer | null
  reward: FeedbackRewardVoucher | null
}

export interface FeedbackRewardSettingsResponse {
  enabled: boolean
  voucherUuid: string | null
  ready: boolean
  voucher: {
    uuid: string
    code: string
    name: string
    label: string
    status: 'draft' | 'active' | 'disabled'
    endsOn: string | null
    maxRedemptions: number | null
    redeemedCount: number
  } | null
  given: number
  left: number | null
  open: boolean
  unavailableReason: string | null
}
