export default defineNuxtRouteMiddleware(async (to) => {
  const session = useSupabaseSession()

  if (!session.value) {
    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath },
    })
  }

  try {
    const profile = await $fetch('/api/auth/me')

    if (profile.role !== 'admin') {
      throw createError({
        statusCode: 403,
        statusMessage: 'You do not have access to this page.',
      })
    }
  }
  catch (error) {
    const statusCode = typeof error === 'object'
      && error
      && 'statusCode' in error
      && typeof error.statusCode === 'number'
      ? error.statusCode
      : 401

    if (statusCode === 403) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You do not have access to this page.',
      })
    }

    return navigateTo({
      path: '/login',
      query: { redirect: to.fullPath },
    })
  }
})
