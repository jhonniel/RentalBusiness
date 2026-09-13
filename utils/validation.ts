import type { z } from 'zod'
import { AppError, ERROR_CODES } from './errors'

export function parseWithSchema<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)

  if (!result.success) {
    throw new AppError(
      'Please check the submitted information.',
      422,
      ERROR_CODES.VALIDATION_ERROR,
      { cause: result.error },
    )
  }

  return result.data
}
