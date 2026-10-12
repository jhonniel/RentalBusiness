export function isExistingAuthEmailError(error: { message?: string, code?: string } | null | undefined) {
  if (!error) {
    return false
  }

  const code = (error.code || '').toLowerCase()
  if (code === 'email_exists' || code === 'user_already_exists') {
    return true
  }

  const message = (error.message || '').toLowerCase()
  return message.includes('already registered')
    || message.includes('already been registered')
    || message.includes('already exists')
    || message.includes('already in use')
}
