import {
  APP_DESCRIPTION,
  APP_NAME,
  BUSINESS_ADDRESS,
  BUSINESS_CITY,
  BUSINESS_COUNTRY,
  BUSINESS_CURRENCY,
  BUSINESS_EMAIL,
  FACEBOOK_URL,
} from './constants'

const PRIVATE_PATHS = [
  '/admin',
  '/dashboard',
  '/profile',
  '/my-rentals',
  '/notifications',
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/confirm',
  '/accept-policies',
  '/receipts',
  '/rentals',
  '/payments',
  '/maintenance',
]

const PUBLIC_SITEMAP_PATHS = [
  '/',
  '/products',
  '/about',
  '/privacy',
  '/terms',
  '/cookies',
] as const

export function normalizeSitePath(path: string): string {
  if (!path || path === '/') {
    return '/'
  }
  return path.startsWith('/') ? path : `/${path}`
}

export function siteCanonical(origin: string, path = '/'): string {
  const base = origin.replace(/\/$/, '')
  const next = normalizeSitePath(path)
  return new URL(next, `${base}/`).toString()
}

export function isPrivatePath(path: string): boolean {
  const next = normalizeSitePath(path)
  return PRIVATE_PATHS.some(prefix => next === prefix || next.startsWith(`${prefix}/`))
}

export function siteRobots(path: string): string {
  return isPrivatePath(path) ? 'noindex, nofollow' : 'index, follow'
}

export function defaultOgImage(origin: string): string {
  return siteCanonical(origin, '/og.png')
}

export function publicSitemapPaths() {
  return [...PUBLIC_SITEMAP_PATHS]
}

export function organizationJsonLd(origin: string) {
  const url = siteCanonical(origin, '/')
  return {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    'name': APP_NAME,
    'url': url,
    'description': APP_DESCRIPTION,
    'email': BUSINESS_EMAIL,
    'image': defaultOgImage(origin),
    'logo': siteCanonical(origin, '/logo.png'),
    'priceRange': BUSINESS_CURRENCY,
    'address': {
      '@type': 'PostalAddress',
      'addressLocality': BUSINESS_CITY,
      'addressCountry': BUSINESS_COUNTRY,
      'streetAddress': BUSINESS_ADDRESS,
    },
    'areaServed': BUSINESS_CITY,
    'sameAs': [FACEBOOK_URL],
  }
}

export function websiteJsonLd(origin: string) {
  const url = siteCanonical(origin, '/')
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    'name': APP_NAME,
    'url': url,
    'description': APP_DESCRIPTION,
    'publisher': {
      '@type': 'Organization',
      'name': APP_NAME,
      'url': url,
    },
    'potentialAction': {
      '@type': 'SearchAction',
      'target': {
        '@type': 'EntryPoint',
        'urlTemplate': `${url}products?search={search_term_string}`,
      },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function productJsonLd(origin: string, product: {
  slug: string
  name: string
  description: string
  sku: string
  dailyPrice: number
  availableQuantity: number
  images: Array<{ url: string }>
}) {
  const url = siteCanonical(origin, `/products/${product.slug}`)
  const images = product.images.map(image => image.url).filter(Boolean)

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    'name': product.name,
    'description': product.description,
    'sku': product.sku,
    'brand': {
      '@type': 'Brand',
      'name': APP_NAME,
    },
    'image': images.length ? images : [defaultOgImage(origin)],
    'offers': {
      '@type': 'Offer',
      'url': url,
      'priceCurrency': BUSINESS_CURRENCY,
      'price': product.dailyPrice,
      'availability': product.availableQuantity > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
    },
  }
}

export function breadcrumbJsonLd(origin: string, crumbs: Array<{ name: string, path: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': crumbs.map((crumb, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'name': crumb.name,
      'item': siteCanonical(origin, crumb.path),
    })),
  }
}

export function howToJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'HowTo',
    'name': `How to rent equipment from ${APP_NAME}`,
    'description': 'Choose your gear, select your dates, then pickup, meetup, or deliver.',
    'step': [
      {
        '@type': 'HowToStep',
        'position': 1,
        'name': 'Choose your gear',
        'text': 'Pick the kit that fits your shoot.',
      },
      {
        '@type': 'HowToStep',
        'position': 2,
        'name': 'Select your dates',
        'text': 'Lock availability for the days you need.',
      },
      {
        '@type': 'HowToStep',
        'position': 3,
        'name': 'Pickup, meetup, or deliver',
        'text': 'Get your gear by pickup, meetup, or delivery.',
      },
    ],
  }
}

export function collectionJsonLd(origin: string, products: Array<{ slug: string, name: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': 'Equipment',
    'url': siteCanonical(origin, '/products'),
    'description': `Browse cameras, drones, Starlink, and production equipment for rent in ${BUSINESS_CITY}.`,
    'mainEntity': {
      '@type': 'ItemList',
      'itemListElement': products.map((product, index) => ({
        '@type': 'ListItem',
        'position': index + 1,
        'url': siteCanonical(origin, `/products/${product.slug}`),
        'name': product.name,
      })),
    },
  }
}

export function aboutPageJsonLd(origin: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'AboutPage',
    'name': `About ${APP_NAME}`,
    'url': siteCanonical(origin, '/about'),
    'description': `${APP_NAME} is based in ${BUSINESS_CITY}. We make renting cameras, drones, and Starlink simple, convenient, and accessible.`,
    'mainEntity': organizationJsonLd(origin),
  }
}
