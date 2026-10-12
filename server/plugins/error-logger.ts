import { loggedErrorText } from '../../utils/errors'
import { logger } from '../utils/logger'

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, { event }) => {
    logger.error('Nitro request failed', {
      requestId: event?.context.requestId,
      path: event?.path,
      error: loggedErrorText(error),
    })
  })
})
