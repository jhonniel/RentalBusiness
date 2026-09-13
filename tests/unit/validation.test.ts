import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { AppError, ERROR_CODES } from '../../utils/errors'
import { parseWithSchema } from '../../utils/validation'

describe('parseWithSchema', () => {
  const schema = z.object({
    quantity: z.number().int().positive(),
  })

  it('returns parsed data when valid', () => {
    expect(parseWithSchema(schema, { quantity: 2 })).toEqual({ quantity: 2 })
  })

  it('throws a validation AppError when invalid', () => {
    try {
      parseWithSchema(schema, { quantity: 0 })
      throw new Error('expected parseWithSchema to throw')
    }
    catch (error) {
      expect(error).toBeInstanceOf(AppError)
      expect(error).toMatchObject({
        statusCode: 422,
        code: ERROR_CODES.VALIDATION_ERROR,
      })
    }
  })
})
