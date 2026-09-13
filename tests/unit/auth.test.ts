import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  loginSchema,
  registerAccountSchema,
  registerSchema,
  updateProfileSchema,
} from '../../utils/auth-validation'
import {
  authCallbackOtpType,
  buildAuthConfirmUrl,
  extractAuthErrorMessage,
  mapAuthError,
  namesFromUserMetadata,
  needsPolicyAcceptance,
  policiesFromUserMetadata,
  accountHomePath,
  resolvePostLoginPath,
  safeRedirectPath,
  toPublicProfile,
} from '../../utils/auth'

describe('auth validation', () => {
  it('accepts a valid registration payload', () => {
    expect(registerSchema.parse({
      firstName: 'Ana',
      lastName: 'Reyes',
      email: 'ana@example.com',
      password: 'securepass',
      confirmPassword: 'securepass',
      termsAccepted: true,
      privacyAcknowledged: true,
    })).toMatchObject({ email: 'ana@example.com', marketingOptIn: false })

    expect(registerSchema.safeParse({
      firstName: 'Ana',
      lastName: 'Reyes',
      email: 'ana@example.com',
      password: 'securepass',
      confirmPassword: 'securepass',
      termsAccepted: true,
      privacyAcknowledged: false,
    }).success).toBe(false)

    expect(registerAccountSchema.parse({
      firstName: 'Ana',
      lastName: 'Reyes',
      email: 'ana@example.com',
      password: 'securepass',
      termsAccepted: true,
      privacyAcknowledged: true,
    })).toMatchObject({ email: 'ana@example.com', marketingOptIn: false })
  })

  it('rejects a role field on profile updates', () => {
    const result = updateProfileSchema.safeParse({
      firstName: 'Ana',
      lastName: 'Reyes',
      phone: '09171234567',
      role: 'admin',
    })

    expect(result.success).toBe(false)
  })

  it('rejects a short password', () => {
    expect(loginSchema.safeParse({
      email: 'ana@example.com',
      password: '',
    }).success).toBe(false)
  })
})

describe('auth helpers', () => {
  it('blocks open redirects', () => {
    expect(safeRedirectPath('https://evil.example')).toBe('/dashboard')
    expect(safeRedirectPath('//evil.example')).toBe('/dashboard')
    expect(safeRedirectPath('/profile')).toBe('/profile')
  })

  it('routes administrators to the operations console after sign-in', () => {
    expect(accountHomePath('admin')).toBe('/admin')
    expect(accountHomePath('customer')).toBe('/dashboard')
    expect(resolvePostLoginPath(undefined, 'admin')).toBe('/admin')
    expect(resolvePostLoginPath('/dashboard', 'admin')).toBe('/admin')
    expect(resolvePostLoginPath('/products', 'admin')).toBe('/products')
    expect(resolvePostLoginPath('/dashboard', 'customer')).toBe('/dashboard')
  })

  it('hides provider error details', () => {
    expect(mapAuthError('Invalid login credentials')).toBe('Email or password is incorrect.')
    expect(mapAuthError('relation "secret" does not exist')).toBe(
      'We could not complete that request. Please try again.',
    )
    expect(extractAuthErrorMessage('{"code":400,"error_code":"validation_failed","msg":"Unsupported provider: provider is not enabled"}'))
      .toBe('Unsupported provider: provider is not enabled')
    expect(mapAuthError('Unsupported provider: provider is not enabled')).toContain('Google sign-in is not enabled')
    expect(namesFromUserMetadata({ given_name: 'Ana', family_name: 'Reyes' })).toEqual({
      firstName: 'Ana',
      lastName: 'Reyes',
    })
    expect(needsPolicyAcceptance(null)).toBe(false)
    expect(needsPolicyAcceptance({ termsVersion: null, privacyPolicyVersion: 'JRY-PRIVACY-v1.0' })).toBe(true)
    expect(needsPolicyAcceptance({ termsVersion: 'JRY-TC-v1.0', privacyPolicyVersion: 'JRY-PRIVACY-v1.0' })).toBe(false)
    expect(authCallbackOtpType('recovery')).toBe('recovery')
    expect(authCallbackOtpType('unknown')).toBe('signup')
    expect(buildAuthConfirmUrl('http://localhost:3000', 'token-1', 'signup'))
      .toBe('http://localhost:3000/confirm?token_hash=token-1&type=signup')
    expect(extractAuthErrorMessage({
      data: { message: 'An account with this email already exists.' },
    })).toBe('An account with this email already exists.')
    expect(policiesFromUserMetadata({
      terms_version: 'JRY-TC-v1.0',
      privacy_policy_version: 'JRY-PRIVACY-v1.0',
      marketing_opt_in: 'true',
    })).toEqual({
      termsAccepted: true,
      privacyAcknowledged: true,
      marketingOptIn: true,
    })
    expect(mapAuthError('invalid flow state, no valid flow state found')).toContain('same browser')
    expect(mapAuthError('An account with this email already exists.')).toBe(
      'An account with this email already exists.',
    )
  })

  it('never includes the internal profile id in public payloads', () => {
    const profile = toPublicProfile({
      id: 99,
      uuid: '11111111-1111-1111-1111-111111111111',
      user_id: 'user-1',
      role: 'customer',
      first_name: 'Ana',
      last_name: 'Reyes',
      phone: null,
    }, 'ana@example.com', true)

    expect(profile).not.toHaveProperty('id')
    expect(profile).not.toHaveProperty('user_id')
    expect(profile.uuid).toBe('11111111-1111-1111-1111-111111111111')
  })
})

describe('profiles RLS migration', () => {
  const sql = readFileSync(
    resolve(process.cwd(), 'supabase/migrations/20260913170000_profiles_and_rls.sql'),
    'utf8',
  )

  it('enables and forces row level security', () => {
    expect(sql).toContain('enable row level security')
    expect(sql).toContain('force row level security')
  })

  it('prevents clients from changing role, user_id, or uuid', () => {
    expect(sql).toContain('role cannot be changed')
    expect(sql).toContain('grant update (first_name, last_name, phone, updated_at)')
    expect(sql).toContain('default \'customer\'')
  })

  it('creates ownership and admin read policies', () => {
    expect(sql).toContain('profiles_select_own')
    expect(sql).toContain('profiles_update_own')
    expect(sql).toContain('profiles_select_admin')
    expect(sql).toContain('user_id = auth.uid()')
  })
})
