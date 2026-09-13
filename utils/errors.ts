export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

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

export function toClientError(error: unknown): ClientErrorPayload {
  if (error instanceof AppError) {
    return {
      message: error.userMessage,
      code: error.code,
      statusCode: error.statusCode,
    }
  }

  return {
    message: 'Something went wrong. Please try again.',
    code: ERROR_CODES.INTERNAL_ERROR,
    statusCode: 500,
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError
}
