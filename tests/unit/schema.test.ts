import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const schema = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260913180000_phase2_core_schema.sql'),
  'utf8',
)
const rls = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260913180001_phase2_rls.sql'),
  'utf8',
)
const seed = readFileSync(resolve(process.cwd(), 'supabase/seed.sql'), 'utf8')
const availabilityGrants = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260913190000_phase5_availability_grants.sql'),
  'utf8',
)
const rentalPolicies = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260913191000_phase6_rental_customer_policies.sql'),
  'utf8',
)
const waiverPolicies = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260913192000_phase7_waiver_policies.sql'),
  'utf8',
)
const paymentPolicies = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260913200000_phase8_payment_policies.sql'),
  'utf8',
)
const receiptPolicies = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260913210000_phase9_receipt_email.sql'),
  'utf8',
)
const hardeningPolicies = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260913220000_phase15_hardening.sql'),
  'utf8',
)
const paymentMethods = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260913230000_phase16_payment_methods.sql'),
  'utf8',
)
const availabilityCalendar = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260913240000_availability_calendar.sql'),
  'utf8',
)
const privacyPolicy = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260913250000_privacy_policy.sql'),
  'utf8',
)
const termsConditions = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260913260000_terms_conditions.sql'),
  'utf8',
)
const existingPolicyVersions = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260913280000_grandfather_existing_policy_versions.sql'),
  'utf8',
)
const rentalIdentity = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260913290000_phase17_rental_identity.sql'),
  'utf8',
)
const siteMaintenance = readFileSync(
  resolve(process.cwd(), 'supabase/migrations/20260913300000_site_maintenance.sql'),
  'utf8',
)

describe('phase 2 schema', () => {
  it('creates the required operational tables', () => {
    const tables = [
      'product_categories',
      'products',
      'product_images',
      'equipment_assets',
      'rental_requests',
      'rental_items',
      'rental_status_history',
      'waiver_versions',
      'waiver_acceptances',
      'payment_transactions',
      'receipts',
      'expenses',
      'recurring_expenses',
      'expense_occurrences',
      'notifications',
      'email_logs',
      'audit_logs',
      'settings',
      'business_profiles',
    ]

    for (const table of tables) {
      expect(schema).toContain(`create table if not exists public.${table}`)
    }
  })

  it('does not recreate profiles', () => {
    expect(schema).not.toContain('create table if not exists public.profiles')
  })

  it('uses overlap-aware availability instead of total inventory alone', () => {
    expect(schema).toContain('product_booked_quantity')
    expect(schema).toContain('rr.starts_on <= p_ends_on')
    expect(schema).toContain('rr.ends_on >= p_starts_on')
    expect(schema).toContain('rental_occupies_inventory')
  })

  it('keeps accepted waiver versions immutable and occurrences unique', () => {
    expect(schema).toContain('accepted waiver versions are immutable')
    expect(schema).toContain('constraint expense_occurrences_unique unique (recurring_expense_id, occurs_on)')
    expect(schema).toContain('constraint rental_requests_code_unique unique (code)')
    expect(schema).toContain('constraint receipts_number_unique unique (receipt_number)')
  })
})

describe('phase 2 RLS', () => {
  it('forces RLS on operational tables', () => {
    expect(rls).toContain('alter table public.rental_requests force row level security')
    expect(rls).toContain('alter table public.payment_transactions force row level security')
    expect(rls).toContain('alter table public.expenses force row level security')
    expect(rls).toContain('alter table public.audit_logs force row level security')
  })

  it('lets customers create and read only their own rentals', () => {
    expect(rls).toContain('rental_requests_insert_own')
    expect(rls).toContain('customer_id = public.current_profile_id()')
    expect(rls).toContain('status in (\'draft\', \'pending\')')
  })

  it('does not allow customers to write payments or expenses', () => {
    expect(rls).toContain('payment_transactions_select_own')
    expect(rls).not.toContain('payment_transactions_insert')
    expect(rls).toContain('expenses_admin_all')
    expect(rls).toContain('audit_logs_admin_select')
  })
})

describe('phase 5 availability grants', () => {
  it('lets anon and authenticated call the overlap function', () => {
    expect(availabilityGrants).toContain('grant execute on function public.product_booked_quantity')
    expect(availabilityGrants).toContain('to anon, authenticated')
  })
})

describe('phase 6 rental policies', () => {
  it('lets customers cancel open requests and delete failed drafts', () => {
    expect(rentalPolicies).toContain('rental_requests_cancel_own')
    expect(rentalPolicies).toContain('rental_requests_delete_own_draft')
    expect(rentalPolicies).toContain('status = \'cancelled\'')
  })
})

describe('phase 7 waiver policies', () => {
  it('lets customers read versions they signed and rotate current after acceptance', () => {
    expect(waiverPolicies).toContain('waiver_versions_select_accepted')
    expect(waiverPolicies).toContain('new.title is distinct from old.title')
    expect(waiverPolicies).toContain('accepted waiver versions are immutable')
  })
})

describe('phase 8 payment policies', () => {
  it('keeps one open payment per rental and lets customers cancel unpaid checkout', () => {
    expect(paymentPolicies).toContain('payment_transactions_one_open_idx')
    expect(paymentPolicies).toContain('awaiting_payment')
    expect(paymentPolicies).toContain('status = \'cancelled\'')
  })
})

describe('phase 9 receipt email', () => {
  it('keeps one receipt per payment and idempotent email hashes', () => {
    expect(receiptPolicies).toContain('receipts_payment_id_unique')
    expect(receiptPolicies).toContain('email_logs_template_hash_idx')
  })
})

describe('phase 15 hardening', () => {
  it('recomputes item prices from the catalog and freezes customer money edits', () => {
    expect(hardeningPolicies).toContain('quote_rental_line')
    expect(hardeningPolicies).toContain('apply_rental_item_catalog_prices')
    expect(hardeningPolicies).toContain('freeze_customer_rental_money')
    expect(hardeningPolicies).toContain('grant update (status) on public.rental_requests to authenticated')
    expect(hardeningPolicies).toContain('wv.is_current = true')
    expect(hardeningPolicies).toContain('to_status in (\'draft\', \'pending\', \'cancelled\')')
    expect(hardeningPolicies).toContain('grant update (read_at) on public.notifications to authenticated')
    expect(hardeningPolicies).toContain('settings_admin_select')
  })
})

describe('phase 16 payment methods', () => {
  it('creates the catalog table, RLS, and public QR bucket', () => {
    expect(paymentMethods).toContain('create table if not exists public.payment_methods')
    expect(paymentMethods).toContain('constraint payment_methods_uuid_unique unique (uuid)')
    expect(paymentMethods).toContain('constraint payment_methods_code_unique unique (code)')
    expect(paymentMethods).toContain('alter table public.payment_methods force row level security')
    expect(paymentMethods).toContain('payment_methods_select_active_or_admin')
    expect(paymentMethods).toContain('payment_methods_admin_write')
    expect(paymentMethods).toContain('payment-qr-images')
    expect(paymentMethods).not.toContain('grant insert on public.payment_methods to anon')
  })
})

describe('availability calendar', () => {
  it('exposes occupying ranges without rental or customer identifiers', () => {
    expect(availabilityCalendar).toContain('create or replace function public.product_occupying_ranges')
    expect(availabilityCalendar).toContain('grant execute on function public.product_occupying_ranges')
    expect(availabilityCalendar).toContain('to anon, authenticated')
    expect(availabilityCalendar).not.toContain('customer_id')
    expect(availabilityCalendar).not.toContain('rr.uuid')
  })
})

describe('terms and conditions acknowledgments', () => {
  it('stores a Terms version on the profile and on each waiver acceptance', () => {
    expect(termsConditions).toContain('terms_version')
    expect(termsConditions).toContain('terms_accepted_at')
    expect(termsConditions).toContain('raw_user_meta_data ->> \'terms_version\'')
    expect(termsConditions).not.toContain('grant insert on public.profiles to anon')
  })
})

describe('rental identity verification', () => {
  it('stores private ID paths and one verification per rental', () => {
    expect(rentalIdentity).toContain('create table if not exists public.rental_identity_verifications')
    expect(rentalIdentity).toContain('constraint rental_identity_verifications_rental_unique unique (rental_id)')
    expect(rentalIdentity).toContain('signer_email')
    expect(rentalIdentity).toContain('force row level security')
    expect(rentalIdentity).not.toContain('grant insert on public.rental_identity_verifications to anon')
  })
})

describe('site maintenance', () => {
  it('creates a singleton page, public images, and a public storage bucket', () => {
    expect(siteMaintenance).toContain('create table if not exists public.site_maintenance')
    expect(siteMaintenance).toContain('constraint site_maintenance_singleton check (id = 1)')
    expect(siteMaintenance).toContain('create table if not exists public.maintenance_images')
    expect(siteMaintenance).toContain('constraint maintenance_images_uuid_unique unique (uuid)')
    expect(siteMaintenance).toContain('alter table public.site_maintenance force row level security')
    expect(siteMaintenance).toContain('site_maintenance_public_read')
    expect(siteMaintenance).toContain('maintenance_images_admin_write')
    expect(siteMaintenance).toContain('maintenance-images')
    expect(siteMaintenance).not.toContain('grant insert on public.site_maintenance to anon')
  })
})

describe('existing account policy versions', () => {
  it('stamps current Terms and Privacy versions on profiles that signed up earlier', () => {
    expect(existingPolicyVersions).toContain('JRY-PRIVACY-v1.0')
    expect(existingPolicyVersions).toContain('JRY-TC-v1.0')
    expect(existingPolicyVersions).toContain('privacy_policy_version is null')
    expect(existingPolicyVersions).toContain('terms_version is null')
  })
})

describe('privacy policy acknowledgments', () => {
  it('stores a version on the profile and on each waiver acceptance', () => {
    expect(privacyPolicy).toContain('privacy_policy_version')
    expect(privacyPolicy).toContain('marketing_opt_in')
    expect(privacyPolicy).toContain('raw_user_meta_data ->> \'privacy_policy_version\'')
    expect(privacyPolicy).not.toContain('grant insert on public.profiles to anon')
  })
})

describe('development seed', () => {
  it('is marked development-only and seeds a local admin login', () => {
    expect(seed).toContain('Do not run against production')
    expect(seed).toContain('Starlink Mini')
    expect(seed).toContain('JRY-WAIVER-v1.0')
    expect(seed).toContain('admin@jryrentals.local')
    expect(seed).toContain('insert into auth.users')
    expect(seed).toContain('insert into public.profiles')
    expect(seed).not.toMatch(/update public\.profiles\s+set[\s\S]*?role = 'admin'/)
  })
})
