import {
  APP_DESCRIPTION,
  APP_NAME,
  BUSINESS_ADDRESS,
  BUSINESS_CITY,
  BUSINESS_COUNTRY,
  BUSINESS_CURRENCY,
  BUSINESS_EMAIL,
  FACEBOOK_URL,
  INSTAGRAM_URL,
} from './constants'
import { HOW_IT_WORKS_INTRO, HOW_IT_WORKS_STEPS } from './site-content'

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
  '/waivers',
  '/maintenance',
  '/feedback',
  '/commissioner',
]

const PUBLIC_SITEMAP_PATHS = [
  '/',
  '/products',
  '/about',
  '/faq',
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

/** Index a category landing page. Search results and later pages point back at that page and stay out of the index. */
export function catalogIndexState(query: { category?: string, search?: string, page?: number }) {
  const category = query.category?.trim()
  const landing = category ? `/products?category=${encodeURIComponent(category)}` : '/products'
  const indexable = !query.search?.trim() && !(query.page && query.page > 1)
  return {
    path: landing,
    robots: indexable ? 'index, follow' : 'noindex, follow',
    indexable,
  }
}

export function robotsTxt(origin: string) {
  return [
    'User-agent: *',
    'Allow: /',
    ...PRIVATE_PATHS.map(path => `Disallow: ${path}`),
    'Disallow: /api',
    '',
    `Sitemap: ${siteCanonical(origin, '/sitemap.xml')}`,
    '',
  ].join('\n')
}

export function renderSitemap(urls: Array<{ loc: string, lastmod?: string | null }>) {
  const body = urls.map((url) => {
    const lastmod = url.lastmod && /^\d{4}-\d{2}-\d{2}/.test(url.lastmod)
      ? `\n    <lastmod>${escapeXml(url.lastmod.slice(0, 10))}</lastmod>`
      : ''
    return `  <url>\n    <loc>${escapeXml(url.loc)}</loc>${lastmod}\n  </url>`
  })
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...body,
    '</urlset>',
    '',
  ].join('\n')
}

function escapeXml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    switch (character) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      default:
        return '&#39;'
    }
  })
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
    'sameAs': [FACEBOOK_URL, INSTAGRAM_URL],
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
  dailyPrice: number | null
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
      ...(product.dailyPrice === null ? {} : { price: product.dailyPrice }),
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
    'description': HOW_IT_WORKS_INTRO,
    'step': HOW_IT_WORKS_STEPS.map((step, index) => ({
      '@type': 'HowToStep',
      'position': index + 1,
      'name': step.title,
      'text': step.copy,
    })),
  }
}

export function collectionJsonLd(origin: string, products: Array<{ slug: string, name: string }>, path = '/products') {
  return {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    'name': 'Equipment',
    'url': siteCanonical(origin, path),
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

export function faqPageJsonLd(origin: string, faqs: Array<{ question: string, answer: string }>) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'name': `${APP_NAME} FAQs`,
    'url': siteCanonical(origin, '/faq'),
    'mainEntity': faqs.map(faq => ({
      '@type': 'Question',
      'name': faq.question,
      'acceptedAnswer': {
        '@type': 'Answer',
        'text': faq.answer,
      },
    })),
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
