import { BUSINESS_CURRENCY, BUSINESS_TIMEZONE, CURRENT_PHASE } from '../../utils/constants'
import { isUsableSecret, productionReadiness } from '../../utils/env'
import { isSmtpConfigured, resolveSmtpConfig } from '../../utils/smtp'
import { isSupabaseConfigured } from '../utils/supabase'
import type { HealthResponse } from '../../types'

export default defineEventHandler((event): HealthResponse => {
  setHeader(event, 'cache-control', 'private, no-store')
  const config = useRuntimeConfig()
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
    resendConfigured: isSmtpConfigured(resolveSmtpConfig({
      user: String(config.smtpUser || process.env.SMTP_USER || process.env.NUXT_SMTP_USER || ''),
      pass: String(config.smtpPass || process.env.SMTP_PASS || process.env.NUXT_SMTP_PASS || ''),
      from: String(config.smtpFrom || process.env.SMTP_FROM || process.env.NUXT_SMTP_FROM || ''),
    })),
  })

  return {
    status: 'ok',
    phase: CURRENT_PHASE,
    timezone: BUSINESS_TIMEZONE,
    currency: BUSINESS_CURRENCY,
    ...readiness,
    timestamp: new Date().toISOString(),
    requestId: event.context.requestId || 'unknown',
  }
})
