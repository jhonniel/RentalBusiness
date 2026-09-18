const CATEGORY_VISUALS: Record<string, string> = {
  drones: '/storefront/drone.png?v=10',
  cameras: '/storefront/action-camera.png?v=11',
  starlink: '/storefront/starlink.png?v=10',
  accessories: '/storefront/tripod.jpg',
  lenses: '/storefront/lens.jpg',
  lighting: '/storefront/lighting.svg',
  audio: '/storefront/action-camera.png?v=11',
  other: '/storefront/action-camera.png?v=11',
}

const PRODUCT_VISUALS: Record<string, string> = {
  'starlink-mini': '/storefront/starlink.png?v=10',
  'dji-air-3': '/storefront/drone.png?v=10',
  'dji-osmo-360': '/storefront/action-camera.png?v=11',
  'sony-a7-iv': '/storefront/action-camera.png?v=11',
}

export const STOREFRONT_KIT_PRODUCTS = [
  { slug: 'starlink-mini', name: 'Starlink Mini', categorySlug: 'starlink' },
  { slug: 'dji-air-3', name: 'DJI Air 3', categorySlug: 'drones' },
  { slug: 'dji-osmo-360', name: 'DJI Osmo 360', categorySlug: 'cameras' },
] as const

const CATEGORY_BLURBS: Record<string, string> = {
  drones: 'Take your shots higher.',
  cameras: 'Capture every detail.',
  starlink: 'Stay connected anywhere.',
  accessories: 'Complete your setup.',
  lenses: 'Prime and zoom glass.',
  lighting: 'Shape the scene.',
  audio: 'Clean sound on location.',
  other: 'More production gear.',
}

const FEATURED_CATEGORY_ORDER = ['drones', 'cameras', 'starlink', 'accessories', 'lenses'] as const

export function categoryVisual(slug: string) {
  return CATEGORY_VISUALS[slug] || '/storefront/action-camera.png'
}

export function productVisual(slug: string, categorySlug?: string) {
  return PRODUCT_VISUALS[slug] || categoryVisual(categorySlug || '')
}

export function resolvedProductImage(
  slug: string,
  categorySlug?: string,
  remoteUrl?: string | null,
) {
  return PRODUCT_VISUALS[slug] || remoteUrl || categoryVisual(categorySlug || '')
}

export function categoryBlurb(slug: string, fallback?: string | null) {
  return CATEGORY_BLURBS[slug] || fallback || 'Browse this kit.'
}

export function productHighlights(input: {
  specifications: Record<string, string>
  includedAccessories: string[]
}) {
  const specs = Object.values(input.specifications).filter(Boolean)
  const extras = input.includedAccessories.filter(Boolean)
  return [...specs, ...extras].slice(0, 3)
}

export function preferredCategories<T extends { slug: string }>(categories: T[], limit = 5) {
  const ranked = [...categories].sort((left, right) => {
    const leftRank = FEATURED_CATEGORY_ORDER.indexOf(left.slug as typeof FEATURED_CATEGORY_ORDER[number])
    const rightRank = FEATURED_CATEGORY_ORDER.indexOf(right.slug as typeof FEATURED_CATEGORY_ORDER[number])
    return (leftRank === -1 ? 99 : leftRank) - (rightRank === -1 ? 99 : rightRank)
  })

  return ranked.slice(0, limit)
}
