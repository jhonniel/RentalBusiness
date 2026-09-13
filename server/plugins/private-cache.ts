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
]

function isPrivatePath(path: string) {
  return PRIVATE_PREFIXES.some(prefix => path === prefix.replace(/\/$/, '') || path.startsWith(prefix))
}

export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('beforeResponse', (event) => {
    if (isPrivatePath(event.path || '')) {
      setHeader(event, 'cache-control', 'private, no-store')
    }
  })
})
