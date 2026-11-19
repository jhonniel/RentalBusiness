import { APP_DESCRIPTION, APP_NAME } from '~/utils/constants'
import { defaultOgImage, siteCanonical, siteRobots } from '~/utils/seo'

interface SiteMetaOptions {
  title?: string
  description?: string
  path?: string
  image?: string
  imageAlt?: string
  imageWidth?: number
  imageHeight?: number
  robots?: string
  ogType?: 'website' | 'product'
}

export function useSiteMeta(options: SiteMetaOptions | (() => SiteMetaOptions) = {}) {
  const config = useRuntimeConfig()
  const origin = String(config.public.siteUrl || 'http://localhost:3000')
  const resolved = computed(() => typeof options === 'function' ? options() : options)
  const ogType = resolved.value.ogType ?? 'website'

  function title() {
    return resolved.value.title ? `${resolved.value.title} · ${APP_NAME}` : `${APP_NAME} · Equipment Rentals`
  }
  function description() {
    return resolved.value.description ?? APP_DESCRIPTION
  }
  function path() {
    return resolved.value.path ?? '/'
  }
  function canonical() {
    return siteCanonical(origin, path())
  }
  function image() {
    const value = resolved.value.image || defaultOgImage(origin)
    return value.startsWith('/') ? siteCanonical(origin, value) : value
  }

  useSeoMeta({
    title,
    description,
    ogTitle: title,
    ogDescription: description,
    ogType: ogType as 'website',
    ogUrl: canonical,
    ogImage: image,
    ogImageAlt: () => resolved.value.imageAlt ?? APP_NAME,
    ogImageWidth: () => resolved.value.image ? resolved.value.imageWidth : 1200,
    ogImageHeight: () => resolved.value.image ? resolved.value.imageHeight : 630,
    ogSiteName: APP_NAME,
    ogLocale: 'en_PH',
    twitterCard: 'summary_large_image',
    twitterTitle: title,
    twitterDescription: description,
    twitterImage: image,
    twitterImageAlt: () => resolved.value.imageAlt ?? APP_NAME,
    robots: () => resolved.value.robots ?? siteRobots(path()),
  })

  useHead({
    htmlAttrs: {
      lang: 'en-PH',
    },
    link: computed(() => [
      { rel: 'canonical', href: canonical() },
    ]),
  })
}
