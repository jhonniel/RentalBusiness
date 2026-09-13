import { isUsableSecret } from '../../utils/env'
import { logger } from '../utils/logger'

export default defineNitroPlugin(() => {
  if (process.env.NODE_ENV !== 'production') {
    return
  }

  const config = useRuntimeConfig()
  const missing = [
    ['SUPABASE_SERVICE_ROLE_KEY', config.supabaseServiceRoleKey || process.env.SUPABASE_SERVICE_ROLE_KEY],
    ['CRON_SECRET', config.cronSecret || process.env.CRON_SECRET],
    ['PAYMENT_WEBHOOK_SECRET', config.paymentWebhookSecret || process.env.PAYMENT_WEBHOOK_SECRET],
    ['SMTP_USER', config.smtpUser || process.env.SMTP_USER],
    ['SMTP_PASS', config.smtpPass || process.env.SMTP_PASS],
  ]
    .filter(([, value]) => !isUsableSecret(String(value || '')))
    .map(([name]) => name)

  if (missing.length) {
    logger.warn('Production is missing required server secrets.', {
      missing,
    })
  }
})
