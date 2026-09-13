import { AppError, ERROR_CODES, toClientError } from '../../utils/errors'
import { logger } from './logger'

export { AppError, ERROR_CODES, toClientError }

export function createInternalError(cause?: unknown): AppError {
  return new AppError(
    'Something went wrong. Please try again.',
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
      errorName: error instanceof Error ? error.name : 'UnknownError',
    })
  }

  return clientError
}
