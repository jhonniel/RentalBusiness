import { describe, expect, it } from 'vitest'
import { AppError, ERROR_CODES, mentionsSupportContact, SUPPORT_MESSAGE, toClientError } from '../../utils/errors'

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
      message: SUPPORT_MESSAGE,
      code: ERROR_CODES.INTERNAL_ERROR,
      statusCode: 500,
    })
  })

  it('hides a database command inside an application error and keeps a normal booking message', () => {
    expect(toClientError(new AppError(
      'function public.quote_rental_line(numeric) is not unique',
      500,
      ERROR_CODES.INTERNAL_ERROR,
    )).message).toBe(SUPPORT_MESSAGE)

    expect(toClientError(new AppError(
      'Those dates are not available. Another request already holds that kit.',
      409,
      ERROR_CODES.CONFLICT,
    )).message).toBe('Those dates are not available. Another request already holds that kit.')
  })
})

describe('support contact', () => {
  it('points customers to Facebook when they are told to contact the admin or shop', () => {
    expect(SUPPORT_MESSAGE).toContain('Facebook')
    expect(mentionsSupportContact(SUPPORT_MESSAGE)).toBe(true)
    expect(mentionsSupportContact('This account has been deleted. Contact the shop for help.')).toBe(true)
    expect(mentionsSupportContact('Choose a pickup date.')).toBe(false)
  })
})
