import { APP_DESCRIPTION, APP_NAME } from '~/utils/constants'
import { defaultOgImage, siteCanonical, siteRobots } from '~/utils/seo'

interface SiteMetaOptions {
  title?: string
  description?: string
  path?: string
  image?: string
  imageAlt?: string
  robots?: string
  ogType?: 'website' | 'product'
}

export function useSiteMeta(options: SiteMetaOptions = {}) {
  const config = useRuntimeConfig()
  const origin = String(config.public.siteUrl || 'http://localhost:3000')
  const path = options.path ?? '/'
  const title = options.title ? `${options.title} · ${APP_NAME}` : `${APP_NAME} · Equipment Rentals`
  const description = options.description ?? APP_DESCRIPTION
  const canonical = siteCanonical(origin, path)
  const image = options.image || defaultOgImage(origin)
  const imageAlt = options.imageAlt ?? APP_NAME
  const robots = options.robots ?? siteRobots(path)

  useSeoMeta({
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogType: options.ogType ?? 'website',
    ogUrl: canonical,
    ogImage: image,
    ogImageAlt: imageAlt,
    ogImageWidth: options.image ? undefined : 1200,
    ogImageHeight: options.image ? undefined : 630,
    ogSiteName: APP_NAME,
    ogLocale: 'en_PH',
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: image,
    twitterImageAlt: imageAlt,
    robots,
  })

  useHead({
    htmlAttrs: {
      lang: 'en-PH',
    },
    link: [
      { rel: 'canonical', href: canonical },
    ],
  })
}
