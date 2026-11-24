import type { SystemHealthStatus } from '~/types/system-health'

export function formatBytes(bytes: number | null | undefined) {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) {
    return '—'
  }
  if (bytes < 1024) {
    return `${bytes} B`
  }
  const units = ['KB', 'MB', 'GB', 'TB']
  let value = bytes / 1024
  let unit = 0
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024
    unit += 1
  }
  const rounded = value >= 10 || Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)
  return `${rounded} ${units[unit]}`
}

export function formatUptime(seconds: number) {
  const total = Math.max(0, Math.floor(seconds))
  const days = Math.floor(total / 86400)
  const hours = Math.floor((total % 86400) / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  if (days > 0) {
    return `${days}d ${hours}h`
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m`
  }
  return `${minutes}m`
}

export function healthTone(status: SystemHealthStatus) {
  if (status === 'ok') {
    return 'text-emerald-700 bg-emerald-50 border-emerald-200'
  }
  if (status === 'degraded') {
    return 'text-amber-800 bg-amber-50 border-amber-200'
  }
  if (status === 'down') {
    return 'text-red-800 bg-red-50 border-red-200'
  }
  return 'text-stone-600 bg-stone-50 border-stone-200'
}

export function healthLabel(status: SystemHealthStatus) {
  if (status === 'ok') {
    return 'Healthy'
  }
  if (status === 'degraded') {
    return 'Attention'
  }
  if (status === 'down') {
    return 'Down'
  }
  return 'Unknown'
}

export function supabaseProjectRef(url: string) {
  try {
    const host = new URL(url).hostname
    const match = host.match(/^([a-z0-9]+)\.supabase\.co$/i)
    return {
      host,
      projectRef: match?.[1] || null,
    }
  }
  catch {
    return { host: null, projectRef: null }
  }
}

export function worstStatus(statuses: SystemHealthStatus[]): SystemHealthStatus {
  if (statuses.includes('down')) {
    return 'down'
  }
  if (statuses.includes('degraded')) {
    return 'degraded'
  }
  if (statuses.includes('unknown')) {
    return 'unknown'
  }
  return 'ok'
}
