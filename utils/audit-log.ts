import type { Json } from '~/types/database.types'
import type { PublicAuditLog } from '~/types/audit'

const SENSITIVE_KEY = /password|secret|token|signature|storage_path|storagepath|apikey|key$/i

export function sanitizeAuditValue(value: Json | undefined | null): Record<string, unknown> | null {
  if (value === null || value === undefined || typeof value !== 'object' || Array.isArray(value)) {
    return value === null || value === undefined ? null : { value }
  }

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => {
    if (SENSITIVE_KEY.test(key)) {
      return [key, '[redacted]']
    }

    if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
      return [key, sanitizeAuditValue(entry as Json)]
    }

    return [key, entry]
  }))
}

export function toPublicAuditLog(row: {
  uuid: string
  action: string
  entity: string
  entity_id: string
  previous_value: Json | null
  new_value: Json | null
  ip_address: string | null
  created_at: string
  profiles?: {
    uuid: string
    first_name: string
    last_name: string
  } | {
    uuid: string
    first_name: string
    last_name: string
  }[] | null
}): PublicAuditLog {
  const actor = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
  const name = [actor?.first_name, actor?.last_name].filter(Boolean).join(' ').trim()

  return {
    uuid: row.uuid,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_id,
    previousValue: sanitizeAuditValue(row.previous_value),
    nextValue: sanitizeAuditValue(row.new_value),
    ipAddress: row.ip_address,
    createdAt: row.created_at,
    actor: actor
      ? { uuid: actor.uuid, name: name || 'Admin' }
      : null,
  }
}

export function auditTargetHref(entity: string, entityId: string) {
  if (entity === 'rental_requests') {
    return `/admin/rentals/${entityId}`
  }

  if (entity === 'products') {
    return `/admin/products/${entityId}`
  }

  if (entity === 'business_profiles') {
    return '/admin/settings'
  }

  if (entity === 'site_maintenance' || entity === 'maintenance_images') {
    return '/admin/maintenance'
  }

  if (entity === 'waiver_versions' || entity === 'waiver_acceptances') {
    return '/admin/waivers'
  }

  return null
}
