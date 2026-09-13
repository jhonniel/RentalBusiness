export default defineNuxtPlugin({
  name: 'auth-fetch',
  dependsOn: ['supabase'],
  setup() {
    const session = useSupabaseSession()

    globalThis.$fetch = $fetch.create({
      onRequest({ options }) {
        const token = session.value?.access_token
        if (!token) {
          return
        }

        const headers = new Headers(options.headers as HeadersInit | undefined)
        if (!headers.has('Authorization')) {
          headers.set('Authorization', `Bearer ${token}`)
        }
        options.headers = headers
      },
    })
  },
})
