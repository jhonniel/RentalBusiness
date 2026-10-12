export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  MAINTENANCE: 'MAINTENANCE',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

export const SUPPORT_MESSAGE = 'Contact the admin for support.'

export interface ClientErrorPayload {
  message: string
  code: ErrorCode
  statusCode: number
}

export class AppError extends Error {
  readonly statusCode: number
  readonly code: ErrorCode
  readonly userMessage: string

  constructor(
    userMessage: string,
    statusCode = 500,
    code: ErrorCode = ERROR_CODES.INTERNAL_ERROR,
    options?: { cause?: unknown },
  ) {
    super(userMessage, options)
    this.name = 'AppError'
    this.userMessage = userMessage
    this.statusCode = statusCode
    this.code = code
  }
}

export function isTechnicalErrorMessage(message: string) {
  const normalized = message.toLowerCase()
  return message.length >= 220
    || normalized.includes('{')
    || normalized.includes('function public.')
    || normalized.includes('is not unique')
    || normalized.includes('sqlstate')
    || normalized.includes('postgres')
    || normalized.includes('pgrst')
    || normalized.includes('relation ')
    || normalized.includes('violates')
    || normalized.includes('constraint')
    || normalized.includes('permission denied')
    || normalized.includes('duplicate key')
    || normalized.includes('null value in column')
    || normalized.includes('does not exist')
    || normalized.includes('syntax error')
    || normalized.includes('jwt')
    || normalized.includes('service role')
    || normalized.includes('stack')
    || normalized.includes('typeerror')
    || normalized.includes('referenceerror')
    || normalized.includes('syntaxerror')
    || normalized.includes('cannot find module')
    || normalized.includes('rollup')
    || normalized.includes('command failed')
    || normalized.includes('econn')
    || normalized.includes('node_modules')
    || normalized.includes('errno')
    || normalized.includes('\n    at ')
    || /\/users\//i.test(message)
    || /\.(ts|vue|js):\d+/.test(normalized)
}

export function publicErrorMessage(message: string, statusCode = 500) {
  if (!message.trim()) {
    return statusCode >= 500 ? SUPPORT_MESSAGE : 'We could not complete that request. Please try again.'
  }

  if (isTechnicalErrorMessage(message)) {
    return SUPPORT_MESSAGE
  }

  return message
}

export function toClientError(error: unknown): ClientErrorPayload {
  if (error instanceof AppError) {
    return {
      message: publicErrorMessage(error.userMessage, error.statusCode),
      code: error.code,
      statusCode: error.statusCode,
    }
  }

  return {
    message: SUPPORT_MESSAGE,
    code: ERROR_CODES.INTERNAL_ERROR,
    statusCode: 500,
  }
}

export function loggedErrorText(error: unknown) {
  if (!(error instanceof Error)) {
    return 'UnknownError'
  }

  const cause = error.cause instanceof Error ? error.cause.message : ''
  return [error.name, error.message, cause].filter(Boolean).join(' | ').slice(0, 500)
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
