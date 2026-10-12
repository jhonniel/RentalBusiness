import { logger } from '~/server/utils/logger'
import { loggedErrorText, toClientError } from '~/utils/errors'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('vue:error', (error) => {
    const clientError = toClientError(error)

    logger.error('Vue render error', {
      code: clientError.code,
      statusCode: clientError.statusCode,
      error: loggedErrorText(error),
    })
  })

  nuxtApp.hook('app:error', (error) => {
    const clientError = toClientError(error)

    logger.error('Nuxt app error', {
      code: clientError.code,
      statusCode: clientError.statusCode,
      error: loggedErrorText(error),
    })
  })
})
