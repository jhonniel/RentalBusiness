export function useSignInRedirect(error: { value?: { statusCode?: number } | null }) {
  const route = useRoute()

  watch(() => error.value?.statusCode, (statusCode) => {
    if (statusCode !== 401) {
      return
    }

    navigateTo({
      path: '/login',
      query: { redirect: route.fullPath },
    })
  }, { immediate: true })
}
