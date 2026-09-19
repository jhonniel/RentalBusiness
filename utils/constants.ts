export const APP_NAME = 'JRY Rentals'
export const APP_TAGLINE = 'Premium gear for your next adventure.'
export const APP_DESCRIPTION = 'Rent cameras, drones, and Starlink in Davao City. Book online with JRY Rentals.'

export const BUSINESS_TIMEZONE = 'Asia/Manila'
export const BUSINESS_CURRENCY = 'PHP'
export const BUSINESS_LOCALE = 'en-PH'
export const BUSINESS_EMAIL = 'jryrentals@gmail.com'
export const RENTAL_REQUEST_NOTIFY_EMAIL = 'contactmejry@gmail.com'
export const BUSINESS_CITY = 'Davao City'
export const BUSINESS_COUNTRY = 'PH'
export const BUSINESS_ADDRESS = 'Davao City, Philippines'
export const FACEBOOK_URL = 'https://www.facebook.com/jryrentals/'

export const CURRENT_COOKIE_POLICY_VERSION = 'JRY-COOKIE-v1.0'
export const CURRENT_COOKIE_POLICY_META = {
  version: CURRENT_COOKIE_POLICY_VERSION,
  title: 'Cookie Policy',
  effectiveDate: '2026-09-18',
  lastUpdated: '2026-09-18',
} as const
export const COOKIE_CONSENT_STORAGE_KEY = 'jry-cookie-consent'

export const CURRENT_PHASE = 17

export const USER_ROLES = ['admin', 'customer'] as const
export type UserRole = (typeof USER_ROLES)[number]

export const RENTAL_STATUSES = [
  'draft',
  'pending',
  'awaiting_payment',
  'paid',
  'approved',
  'ready_for_pickup',
  'active',
  'returned',
  'completed',
  'cancelled',
  'rejected',
  'overdue',
] as const
export type RentalStatus = (typeof RENTAL_STATUSES)[number]

export const PAYMENT_STATUSES = [
  'pending',
  'processing',
  'paid',
  'failed',
  'refunded',
  'partially_refunded',
  'cancelled',
] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export const PRODUCT_STATUSES = ['draft', 'active', 'coming_soon', 'hidden', 'archived'] as const
export type ProductStatus = (typeof PRODUCT_STATUSES)[number]
export const PUBLIC_CATALOG_PRODUCT_STATUSES = ['active', 'coming_soon'] as const
export type PublicCatalogProductStatus = (typeof PUBLIC_CATALOG_PRODUCT_STATUSES)[number]

export function isPublicCatalogProductStatus(status: string): status is PublicCatalogProductStatus {
  return (PUBLIC_CATALOG_PRODUCT_STATUSES as readonly string[]).includes(status)
}

export function isBookableProductStatus(status: string) {
  return status === 'active'
}

export const PRICE_FIELD_KEYS = [
  'daily',
  'weekly',
  'monthly',
  'deposit',
  'lateFee',
  'replacementValue',
] as const
export type PriceFieldKey = (typeof PRICE_FIELD_KEYS)[number]

export const EQUIPMENT_STATUSES = [
  'available',
  'reserved',
  'rented',
  'maintenance',
  'damaged',
  'lost',
  'retired',
] as const
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number]

export const INVENTORY_OCCUPYING_RENTAL_STATUSES = [
  'pending',
  'awaiting_payment',
  'paid',
  'approved',
  'ready_for_pickup',
  'active',
  'overdue',
] as const

export const CALENDAR_RENTAL_STATUSES = [
  ...INVENTORY_OCCUPYING_RENTAL_STATUSES,
  'returned',
  'completed',
] as const
export type CalendarRentalStatus = (typeof CALENDAR_RENTAL_STATUSES)[number]

export const EXPENSE_STATUSES = ['pending', 'paid', 'void'] as const
export type ExpenseStatus = (typeof EXPENSE_STATUSES)[number]

export const RECURRING_EXPENSE_STATUSES = ['active', 'paused', 'ended'] as const
export type RecurringExpenseStatus = (typeof RECURRING_EXPENSE_STATUSES)[number]

export const EXPENSE_CATEGORIES = [
  'internet',
  'electricity',
  'maintenance',
  'repairs',
  'software',
  'subscription',
  'marketing',
  'transportation',
  'staff',
  'insurance',
  'equipment',
  'office',
  'other',
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const EXPENSE_FREQUENCIES = [
  'daily',
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
  'custom',
] as const
export type ExpenseFrequency = (typeof EXPENSE_FREQUENCIES)[number]

export const PRODUCT_CATEGORIES = [
  'starlink',
  'cameras',
  'drones',
  'lenses',
  'accessories',
  'lighting',
  'audio',
  'other',
] as const
export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number]
