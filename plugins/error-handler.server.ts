import { logger } from '~/server/utils/logger'
import { toClientError } from '~/utils/errors'

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('vue:error', (error) => {
    const clientError = toClientError(error)

    logger.error('Vue render error', {
      code: clientError.code,
      statusCode: clientError.statusCode,
    })
  })

  nuxtApp.hook('app:error', (error) => {
    const clientError = toClientError(error)

    logger.error('Nuxt app error', {
      code: clientError.code,
      statusCode: clientError.statusCode,
    })
  })
})
