import { robotsTxt } from '../../utils/seo'

export default defineEventHandler((event) => {
  const origin = String(useRuntimeConfig().public.siteUrl || 'http://localhost:3000')
  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return robotsTxt(origin)
})
