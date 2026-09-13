import nodemailer from 'nodemailer'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../types/database.types'
import { emailPayloadHash, type EmailTemplate } from '../../utils/email'
import { isSmtpConfigured, resolveSmtpConfig, type SmtpConfig } from '../../utils/smtp'
import { logger } from '../utils/logger'
import {
  findEmailLogByHash,
  insertEmailLog,
  updateEmailLog,
} from '../repositories/email.repository'

type Client = SupabaseClient<Database>

interface SendEmailInput {
  to: string
  template: EmailTemplate
  entityKey: string
  subject: string
  html: string
}

function smtpSettings(): SmtpConfig {
  const config = useRuntimeConfig()
  return resolveSmtpConfig({
    host: String(config.smtpHost || process.env.SMTP_HOST || process.env.NUXT_SMTP_HOST || ''),
    port: config.smtpPort || process.env.SMTP_PORT || process.env.NUXT_SMTP_PORT || '',
    user: String(config.smtpUser || process.env.SMTP_USER || process.env.NUXT_SMTP_USER || ''),
    pass: String(config.smtpPass || process.env.SMTP_PASS || process.env.NUXT_SMTP_PASS || ''),
    from: String(config.smtpFrom || process.env.SMTP_FROM || process.env.NUXT_SMTP_FROM || ''),
  })
}

async function deliverSmtp(input: { to: string, subject: string, html: string }) {
  const smtp = smtpSettings()
  if (!isSmtpConfigured(smtp)) {
    throw new Error('Gmail SMTP is not configured.')
  }

  const transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: {
      user: smtp.user,
      pass: smtp.pass,
    },
  })

  const info = await transporter.sendMail({
    from: smtp.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
  })

  const providerId = String(info.messageId || '').trim()
  if (!providerId) {
    throw new Error('SMTP accepted the message without a provider id.')
  }

  return providerId
}

export async function sendTemplatedEmail(client: Client, input: SendEmailInput) {
  const payloadHash = emailPayloadHash(input.template, input.entityKey)
  const existing = await findEmailLogByHash(client, input.template, payloadHash)
  if (existing?.status === 'sent') {
    return existing
  }

  const log = existing ?? await insertEmailLog(client, {
    to_email: input.to,
    template: input.template,
    status: 'queued',
    payload_hash: payloadHash,
  })

  if (!log) {
    return findEmailLogByHash(client, input.template, payloadHash)
  }

  try {
    const providerId = await deliverSmtp({
      to: input.to,
      subject: input.subject,
      html: input.html,
    })
    await updateEmailLog(client, log.uuid, {
      status: 'sent',
      provider_id: providerId,
      sent_at: new Date().toISOString(),
    })
    return { uuid: log.uuid, status: 'sent' as const }
  }
  catch (error) {
    await updateEmailLog(client, log.uuid, { status: 'failed' })
    logger.warn('Email was not sent', {
      template: input.template,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    })
    return { uuid: log.uuid, status: 'failed' as const }
  }
}
