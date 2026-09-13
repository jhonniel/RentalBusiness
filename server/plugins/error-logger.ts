import { logger } from '../utils/logger'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, { event }) => {
    logger.error('Nitro request failed', {
      requestId: event?.context.requestId,
      path: event?.path,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    })
  })
})
