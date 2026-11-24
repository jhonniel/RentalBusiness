export type SystemHealthStatus = 'ok' | 'degraded' | 'down' | 'unknown'

export interface SystemHealthCheck {
  id: string
  label: string
  status: SystemHealthStatus
  detail: string
}

export interface SystemHealthResponse {
  overall: SystemHealthStatus
  checkedAt: string
  app: {
    status: SystemHealthStatus
    phase: number
    timezone: string
    currency: string
    node: string
    uptimeSeconds: number
    memoryUsedMb: number
    memoryRssMb: number
    siteUrl: string
  }
  readiness: {
    ready: boolean
    supabaseConfigured: boolean
    serviceRoleConfigured: boolean
    cronConfigured: boolean
    webhookConfigured: boolean
    smtpConfigured: boolean
  }
  vercel: {
    present: boolean
    env: string | null
    url: string | null
    region: string | null
    commitSha: string | null
    commitRef: string | null
  }
  supabase: {
    status: SystemHealthStatus
    host: string | null
    projectRef: string | null
    latencyMs: number | null
    detail: string
  }
  database: {
    status: SystemHealthStatus
    name: string | null
    sizeBytes: number | null
    sizeLabel: string | null
    tables: Array<{ name: string, sizeBytes: number, sizeLabel: string }>
    detail: string
    setupRequired: boolean
  }
  storage: {
    status: SystemHealthStatus
    buckets: Array<{ id: string, public: boolean, fileSizeLimit: number | null }>
    detail: string
  }
  email: {
    status: SystemHealthStatus
    configured: boolean
    fromConfigured: boolean
    detail: string
  }
  maintenance: {
    status: SystemHealthStatus
    enabled: boolean
    detail: string
  }
  checks: SystemHealthCheck[]
}
