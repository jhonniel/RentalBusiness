import { SUPPORT_MESSAGE } from '~/utils/errors'

let showingSupportError = false

export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.vueApp.config.errorHandler = (error) => {
    console.error(error)
    if (showingSupportError) {
      return
    }
    showingSupportError = true
    showError({
      statusCode: 500,
      statusMessage: SUPPORT_MESSAGE,
      message: SUPPORT_MESSAGE,
      fatal: true,
    })
  }
})
