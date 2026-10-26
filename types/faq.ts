export interface PublicFaq {
  uuid: string
  question: string
  answer: string
  sortOrder: number
  isActive: boolean
  updatedAt: string | null
}

export interface AdminFaqListResponse {
  items: PublicFaq[]
  ready: boolean
}
