import { siteCanonical } from '../../utils/seo'

export default defineEventHandler((event) => {
  const origin = String(useRuntimeConfig().public.siteUrl || 'http://localhost:3000')
  const body = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /admin',
    'Disallow: /dashboard',
    'Disallow: /login',
    'Disallow: /register',
    'Disallow: /my-rentals',
    'Disallow: /profile',
    'Disallow: /notifications',
    'Disallow: /rentals',
    'Disallow: /receipts',
    'Disallow: /payments',
    'Disallow: /maintenance',
    'Disallow: /confirm',
    'Disallow: /accept-policies',
    'Disallow: /reset-password',
    'Disallow: /forgot-password',
    'Disallow: /verify-email',
    'Disallow: /api',
    '',
    `Sitemap: ${siteCanonical(origin, '/sitemap.xml')}`,
    '',
  ].join('\n')

  setHeader(event, 'content-type', 'text/plain; charset=utf-8')
  return body
})
