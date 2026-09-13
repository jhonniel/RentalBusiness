export default defineNuxtPlugin(async () => {
  const session = useSupabaseSession()
  const { refreshProfile } = useAuth()

  if (session.value) {
    await refreshProfile()
  }
})
