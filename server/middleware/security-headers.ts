const SECURITY_HEADERS: Record<string, string> = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'DENY',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
  'content-security-policy': [
    'default-src \'self\'',
    'base-uri \'self\'',
    'form-action \'self\'',
    'frame-ancestors \'none\'',
    'object-src \'none\'',
    'script-src \'self\' \'unsafe-inline\' \'unsafe-eval\'',
    'style-src \'self\' \'unsafe-inline\'',
    'img-src \'self\' data: blob: https:',
    'font-src \'self\' data:',
    'connect-src \'self\' https://*.supabase.co wss://*.supabase.co',
  ].join('; '),
}

const PRIVATE_PREFIXES = [
  '/api/',
  '/admin',
  '/dashboard',
  '/my-rentals',
  '/profile',
  '/notifications',
  '/rentals/',
  '/receipts/',
  '/payments/',
  '/maintenance',
]

export default defineEventHandler((event) => {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    setHeader(event, name, value)
  }

  const path = event.path || ''
  if (PRIVATE_PREFIXES.some(prefix => path === prefix.replace(/\/$/, '') || path.startsWith(prefix))) {
    setHeader(event, 'cache-control', 'private, no-store')
  }
})
