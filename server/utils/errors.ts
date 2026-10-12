import { AppError, ERROR_CODES, loggedErrorText, toClientError } from '../../utils/errors'
import { logger } from './logger'

export { AppError, ERROR_CODES, toClientError }

export function createInternalError(cause?: unknown): AppError {
  return new AppError(
    'Contact the admin for support.',
    500,
    ERROR_CODES.INTERNAL_ERROR,
    { cause },
  )
}

export function logAndToClientError(error: unknown, requestId?: string) {
  const clientError = toClientError(error)

  if (!(error instanceof AppError) || error.statusCode >= 500) {
    logger.error('Unhandled server error', {
      requestId,
      code: clientError.code,
      statusCode: clientError.statusCode,
      error: loggedErrorText(error),
    })
  }

  return clientError
}
