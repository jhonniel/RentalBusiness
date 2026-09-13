import { describe, expect, it } from 'vitest'
import { adminAuditListQuerySchema } from '../../utils/admin-validation'
import { auditTargetHref, sanitizeAuditValue, toPublicAuditLog } from '../../utils/audit-log'

describe('audit logs', () => {
  it('redacts secrets and omits internal actor ids', () => {
    const log = toPublicAuditLog({
      uuid: '11111111-1111-1111-1111-111111111111',
      action: 'settings.update',
      entity: 'business_profiles',
      entity_id: 'business',
      previous_value: { name: 'JRY', password: 'secret', token: 'abc' },
      new_value: { name: 'JRY Rentals' },
      ip_address: '127.0.0.1',
      created_at: '2026-09-13T00:00:00.000Z',
      profiles: { uuid: '22222222-2222-2222-2222-222222222222', first_name: 'Ana', last_name: 'Reyes' },
    })

    expect(log).not.toHaveProperty('id')
    expect(log).not.toHaveProperty('actor_id')
    expect(log.actor).toEqual({
      uuid: '22222222-2222-2222-2222-222222222222',
      name: 'Ana Reyes',
    })
    expect(sanitizeAuditValue({ password: 'x', storage_path: 'private/id.jpg', name: 'Kit' })).toEqual({
      password: '[redacted]',
      storage_path: '[redacted]',
      name: 'Kit',
    })
  })

  it('links known entities and accepts list filters', () => {
    expect(auditTargetHref('rental_requests', 'LUM-20260913-00001')).toBe('/admin/rentals/LUM-20260913-00001')
    expect(auditTargetHref('business_profiles', 'business')).toBe('/admin/settings')
    expect(auditTargetHref('reports', 'sales')).toBeNull()
    expect(adminAuditListQuerySchema.parse({ page: '2', entity: 'products' })).toMatchObject({
      page: 2,
      entity: 'products',
    })
  })
})
