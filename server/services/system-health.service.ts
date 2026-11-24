import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import type { SystemHealthCheck, SystemHealthResponse, SystemHealthStatus } from '../../types/system-health'
import { BUSINESS_CURRENCY, BUSINESS_TIMEZONE, CURRENT_PHASE } from '../../utils/constants'
import { isUsableSecret, productionReadiness } from '../../utils/env'
import { isSmtpConfigured, resolveSmtpConfig } from '../../utils/smtp'
import { formatBytes, supabaseProjectRef, worstStatus } from '../../utils/system-health'
import { getSupabaseAdminClient, isSupabaseConfigured } from '../utils/supabase'
import { getAdminMaintenance } from './maintenance.service'

type Client = SupabaseClient<Database>

function siteOrigin() {
  const config = useRuntimeConfig()
  return String(config.public.siteUrl || process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, '')
}

function vercelInfo() {
  const present = Boolean(process.env.VERCEL || process.env.VERCEL_ENV)
  return {
    present,
    env: process.env.VERCEL_ENV || (present ? 'unknown' : null),
    url: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null,
    region: process.env.VERCEL_REGION || null,
    commitSha: process.env.VERCEL_GIT_COMMIT_SHA || null,
    commitRef: process.env.VERCEL_GIT_COMMIT_REF || null,
  }
}

async function probeSupabase(admin: Client) {
  const config = useRuntimeConfig()
  const url = String(config.public.supabaseUrl || process.env.NUXT_PUBLIC_SUPABASE_URL || '')
  const { host, projectRef } = supabaseProjectRef(url)
  const started = Date.now()

  try {
    const { error } = await admin.from('profiles').select('uuid', { count: 'exact', head: true }).limit(1)
    const latencyMs = Date.now() - started
    if (error) {
      return {
        status: 'down' as const,
        host,
        projectRef,
        latencyMs,
        detail: error.message || 'Supabase query failed.',
      }
    }
    return {
      status: (latencyMs > 2000 ? 'degraded' : 'ok') as SystemHealthStatus,
      host,
      projectRef,
      latencyMs,
      detail: latencyMs > 2000
        ? `Connected, but slow (${latencyMs} ms).`
        : `Connected (${latencyMs} ms).`,
    }
  }
  catch (error) {
    return {
      status: 'down' as const,
      host,
      projectRef,
      latencyMs: Date.now() - started,
      detail: error instanceof Error ? error.message : 'Supabase is unreachable.',
    }
  }
}

async function probeDatabase(admin: Client) {
  try {
    const { data, error } = await (admin as unknown as SupabaseClient).rpc('admin_database_health')
    if (error) {
      const missing = error.code === 'PGRST202' || error.message?.includes('Could not find the function')
      return {
        status: (missing ? 'unknown' : 'degraded') as SystemHealthStatus,
        name: null as string | null,
        sizeBytes: null as number | null,
        sizeLabel: null as string | null,
        tables: [] as Array<{ name: string, sizeBytes: number, sizeLabel: string }>,
        detail: missing
          ? 'Paste 20261124160000_admin_database_health.sql in Supabase to show database size.'
          : (error.message || 'Database size is unavailable.'),
        setupRequired: missing,
      }
    }

    const payload = data && typeof data === 'object' ? data as {
      databaseName?: string
      sizeBytes?: number
      tables?: Array<{ name?: string, size_bytes?: number, sizeBytes?: number }>
    } : null

    const sizeBytes = typeof payload?.sizeBytes === 'number' ? payload.sizeBytes : null
    const tables = (payload?.tables || []).map((row) => {
      const bytes = Number(row.size_bytes ?? row.sizeBytes ?? 0)
      return {
        name: String(row.name || 'table'),
        sizeBytes: bytes,
        sizeLabel: formatBytes(bytes),
      }
    })

    return {
      status: 'ok' as const,
      name: payload?.databaseName || null,
      sizeBytes,
      sizeLabel: formatBytes(sizeBytes),
      tables,
      detail: sizeBytes != null ? `Database size ${formatBytes(sizeBytes)}.` : 'Database size loaded.',
      setupRequired: false,
    }
  }
  catch (error) {
    return {
      status: 'degraded' as const,
      name: null,
      sizeBytes: null,
      sizeLabel: null,
      tables: [],
      detail: error instanceof Error ? error.message : 'Database size is unavailable.',
      setupRequired: false,
    }
  }
}

async function probeStorage(admin: Client) {
  try {
    const { data, error } = await admin.storage.listBuckets()
    if (error) {
      return {
        status: 'degraded' as const,
        buckets: [] as Array<{ id: string, public: boolean, fileSizeLimit: number | null }>,
        detail: error.message || 'Storage buckets could not be listed.',
      }
    }
    const buckets = (data || []).map(bucket => ({
      id: bucket.id,
      public: Boolean(bucket.public),
      fileSizeLimit: typeof bucket.file_size_limit === 'number' ? bucket.file_size_limit : null,
    }))
    return {
      status: 'ok' as const,
      buckets,
      detail: buckets.length
        ? `${buckets.length} storage bucket${buckets.length === 1 ? '' : 's'} available.`
        : 'No storage buckets found.',
    }
  }
  catch (error) {
    return {
      status: 'degraded' as const,
      buckets: [],
      detail: error instanceof Error ? error.message : 'Storage is unavailable.',
    }
  }
}

export async function getAdminSystemHealth(client: Client): Promise<SystemHealthResponse> {
  const config = useRuntimeConfig()
  const smtp = resolveSmtpConfig({
    user: String(config.smtpUser || process.env.SMTP_USER || process.env.NUXT_SMTP_USER || ''),
    pass: String(config.smtpPass || process.env.SMTP_PASS || process.env.NUXT_SMTP_PASS || ''),
    from: String(config.smtpFrom || process.env.SMTP_FROM || process.env.NUXT_SMTP_FROM || ''),
  })
  const smtpConfigured = isSmtpConfigured(smtp)
  const readiness = productionReadiness({
    supabaseConfigured: isSupabaseConfigured(),
    serviceRoleConfigured: isUsableSecret(
      String(config.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NUXT_SUPABASE_SERVICE_ROLE_KEY || ''),
    ),
    cronConfigured: isUsableSecret(
      String(config.cronSecret || process.env.CRON_SECRET || process.env.NUXT_CRON_SECRET || ''),
    ),
    webhookConfigured: isUsableSecret(
      String(config.paymentWebhookSecret || process.env.PAYMENT_WEBHOOK_SECRET || process.env.NUXT_PAYMENT_WEBHOOK_SECRET || ''),
    ),
    resendConfigured: smtpConfigured,
  })

  let admin: Client | null = null
  try {
    admin = getSupabaseAdminClient()
  }
  catch {
    admin = null
  }

  const [supabase, database, storage, maintenance] = await Promise.all([
    admin
      ? probeSupabase(admin)
      : Promise.resolve({
          status: 'down' as const,
          host: supabaseProjectRef(String(config.public.supabaseUrl || '')).host,
          projectRef: supabaseProjectRef(String(config.public.supabaseUrl || '')).projectRef,
          latencyMs: null,
          detail: readiness.serviceRoleConfigured
            ? 'Supabase admin client failed to start.'
            : 'Service-role key is missing or still a placeholder.',
        }),
    admin ? probeDatabase(admin) : Promise.resolve({
      status: 'unknown' as const,
      name: null,
      sizeBytes: null,
      sizeLabel: null,
      tables: [],
      detail: 'Database size needs a working service-role connection.',
      setupRequired: false,
    }),
    admin ? probeStorage(admin) : Promise.resolve({
      status: 'unknown' as const,
      buckets: [],
      detail: 'Storage needs a working service-role connection.',
    }),
    getAdminMaintenance(client).then(status => ({
      status: (status.enabled ? 'degraded' : 'ok') as SystemHealthStatus,
      enabled: status.enabled,
      detail: status.enabled
        ? 'Maintenance mode is on. Public storefront APIs return 503.'
        : 'Storefront is open.',
    })).catch(() => ({
      status: 'unknown' as const,
      enabled: false,
      detail: 'Maintenance status could not be loaded.',
    })),
  ])

  const email = {
    status: (smtpConfigured ? 'ok' : 'degraded') as SystemHealthStatus,
    configured: smtpConfigured,
    fromConfigured: Boolean(smtp.from?.trim()),
    detail: smtpConfigured
      ? 'Gmail SMTP is configured.'
      : 'SMTP user, password, or from-address is missing.',
  }

  const memory = process.memoryUsage()
  const app = {
    status: 'ok' as const,
    phase: CURRENT_PHASE,
    timezone: BUSINESS_TIMEZONE,
    currency: BUSINESS_CURRENCY,
    node: process.version,
    uptimeSeconds: Math.round(process.uptime()),
    memoryUsedMb: Math.round((memory.heapUsed / (1024 * 1024)) * 10) / 10,
    memoryRssMb: Math.round((memory.rss / (1024 * 1024)) * 10) / 10,
    siteUrl: siteOrigin(),
  }

  const vercel = vercelInfo()
  const checks: SystemHealthCheck[] = [
    {
      id: 'readiness',
      label: 'Production secrets',
      status: readiness.ready ? 'ok' : 'degraded',
      detail: readiness.ready
        ? 'Supabase, service role, cron, webhook, and SMTP are set.'
        : 'One or more production secrets are missing or still placeholders.',
    },
    {
      id: 'supabase',
      label: 'Supabase API',
      status: supabase.status,
      detail: supabase.detail,
    },
    {
      id: 'database',
      label: 'Database storage',
      status: database.status,
      detail: database.detail,
    },
    {
      id: 'storage',
      label: 'File storage',
      status: storage.status,
      detail: storage.detail,
    },
    {
      id: 'email',
      label: 'Email (SMTP)',
      status: email.status,
      detail: email.detail,
    },
    {
      id: 'vercel',
      label: 'Vercel runtime',
      status: vercel.present ? 'ok' : 'unknown',
      detail: vercel.present
        ? `Running on Vercel (${vercel.env || 'unknown'}${vercel.region ? `, ${vercel.region}` : ''}).`
        : 'Not on Vercel (local or other host).',
    },
    {
      id: 'maintenance',
      label: 'Maintenance mode',
      status: maintenance.status,
      detail: maintenance.detail,
    },
  ]

  return {
    overall: worstStatus(checks.map(check => check.status)),
    checkedAt: new Date().toISOString(),
    app,
    readiness: {
      ready: readiness.ready,
      supabaseConfigured: readiness.supabaseConfigured,
      serviceRoleConfigured: readiness.serviceRoleConfigured,
      cronConfigured: readiness.cronConfigured,
      webhookConfigured: readiness.webhookConfigured,
      smtpConfigured: readiness.resendConfigured,
    },
    vercel,
    supabase,
    database,
    storage,
    email,
    maintenance,
    checks,
  }
}
