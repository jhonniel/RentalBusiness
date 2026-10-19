export type CommissionStatus = 'unclaimed' | 'collected'

export interface AdminCommission {
  uuid: string
  amount: number
  status: CommissionStatus
  earnedOn: string
  collectedAt: string | null
  rental: {
    uuid: string
    code: string
    pickupAt: string | null
    returnAt: string | null
    equipment: string
  }
  commissioner: {
    uuid: string
    firstName: string
    lastName: string
  }
}

export interface AdminCommissionerSummary {
  uuid: string
  firstName: string
  lastName: string
  unclaimedAmount: number
  collectedAmount: number
  unclaimedCount: number
}

export interface AdminCommissionsResponse {
  summary: AdminCommissionerSummary[]
  unclaimed: AdminCommission[]
  collected: AdminCommission[]
}
