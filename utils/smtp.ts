import { isUsableSecret } from './env'

export interface SmtpConfig {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
}

export function resolveSmtpConfig(source: {
  host?: string | null
  port?: string | number | null
  user?: string | null
  pass?: string | null
  from?: string | null
}): SmtpConfig {
  const user = String(source.user || '').trim()
  const rawPass = String(source.pass || '').trim()
  const compactPass = rawPass.replace(/\s+/g, '')
  const pass = /^[a-z0-9]{16}$/i.test(compactPass) ? compactPass : rawPass
  const host = String(source.host || 'smtp.gmail.com').trim() || 'smtp.gmail.com'
  const port = Number(source.port || 587) || 587
  const from = String(source.from || '').trim() || (user ? `JRY Rentals <${user}>` : '')

  return {
    host,
    port,
    secure: port === 465,
    user,
    pass,
    from,
  }
}

export function isSmtpConfigured(config: Pick<SmtpConfig, 'user' | 'pass' | 'from'>) {
  return isUsableSecret(config.user) && isUsableSecret(config.pass) && isUsableSecret(config.from)
}
