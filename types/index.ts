export type {
  EquipmentStatus,
  ExpenseCategory,
  ExpenseFrequency,
  ExpenseStatus,
  PaymentStatus,
  ProductCategory,
  ProductStatus,
  RecurringExpenseStatus,
  RentalStatus,
  UserRole,
} from '~/utils/constants'

/**
 * Public identifiers must be uuid or code — never database primary keys.
 */
export type PublicId = string

export interface HealthResponse {
  status: 'ok'
  phase: number
  timezone: string
  currency: string
  supabaseConfigured: boolean
  serviceRoleConfigured: boolean
  cronConfigured: boolean
  webhookConfigured: boolean
  /** True when Gmail SMTP user, password, and from-address are set. */
  resendConfigured: boolean
  ready: boolean
  timestamp: string
  requestId: string
}
