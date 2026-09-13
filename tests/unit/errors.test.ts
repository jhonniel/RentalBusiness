import { describe, expect, it } from 'vitest'
import { AppError, ERROR_CODES, toClientError } from '../../utils/errors'

describe('toClientError', () => {
  it('returns the user-safe payload for AppError', () => {
    const error = new AppError('Please sign in again.', 401, ERROR_CODES.UNAUTHORIZED)
    expect(toClientError(error)).toEqual({
      message: 'Please sign in again.',
      code: ERROR_CODES.UNAUTHORIZED,
      statusCode: 401,
    })
  })

  it('hides unknown error details', () => {
    expect(toClientError(new Error('relation "secret" does not exist'))).toEqual({
      message: 'Something went wrong. Please try again.',
      code: ERROR_CODES.INTERNAL_ERROR,
      statusCode: 500,
    })
  })
})
