import type { H3Event } from 'h3'
import { logAndToClientError } from './errors'

export function defineApiHandler<T>(handler: (event: H3Event) => T | Promise<T>) {
  return defineEventHandler(async (event) => {
    setHeader(event, 'cache-control', 'private, no-store')
    try {
      return await handler(event)
    }
    catch (error) {
      const payload = logAndToClientError(error, event.context.requestId)
      throw createError({
        statusCode: payload.statusCode,
        statusMessage: payload.message,
        data: {
          code: payload.code,
          message: payload.message,
        },
      })
    }
  })
}
