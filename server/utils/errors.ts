import { AppError, ERROR_CODES, loggedErrorText, SUPPORT_MESSAGE, toClientError } from '../../utils/errors'
import { logger } from './logger'

export { AppError, ERROR_CODES, toClientError }

export function queryLoadError(message: string, error: { code?: string, message?: string }) {
  const code = error.code ?? ''
  const text = error.message ?? ''
  if (
    code === '42501'
    || code === 'PGRST301'
    || /jwt|not authenticated|permission denied/i.test(text)
  ) {
    return new AppError('Please sign in to continue.', 401, ERROR_CODES.UNAUTHORIZED, { cause: error })
  }

  return new AppError(message, 500, ERROR_CODES.INTERNAL_ERROR, { cause: error })
}

export function createInternalError(cause?: unknown): AppError {
  return new AppError(
    SUPPORT_MESSAGE,
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
