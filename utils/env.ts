export function isUsableSecret(value?: string | null): value is string {
  const next = String(value ?? '').trim()
  return next.length > 0 && !next.toLowerCase().includes('placeholder')
}

export function productionReadiness(input: {
  supabaseConfigured: boolean
  serviceRoleConfigured: boolean
  cronConfigured: boolean
  webhookConfigured: boolean
  resendConfigured: boolean
}) {
  return {
    ...input,
    ready: input.supabaseConfigured
      && input.serviceRoleConfigured
      && input.cronConfigured
      && input.webhookConfigured
      && input.resendConfigured,
  }
}
