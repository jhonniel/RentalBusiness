export interface PublicBusinessSettings {
  uuid: string | null
  name: string
  email: string | null
  phone: string | null
  address: string | null
  currency: string
  timezone: string
  lateFeePolicy: string | null
  depositRules: string | null
  cancellationRules: string | null
}
