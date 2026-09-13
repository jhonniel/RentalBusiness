import { getPublicProducts } from '../services/catalog.service'
import { getPublicSupabaseClient, isSupabaseConfigured } from '../utils/supabase'
import { publicSitemapPaths, siteCanonical } from '../../utils/seo'

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

export default defineEventHandler(async (event) => {
  const origin = String(useRuntimeConfig().public.siteUrl || 'http://localhost:3000')
  const paths = publicSitemapPaths()

  if (isSupabaseConfigured()) {
    try {
      const client = await getPublicSupabaseClient(event)
      const catalog = await getPublicProducts(client, { page: 1, pageSize: 50 })
      for (const product of catalog.items) {
        paths.push(`/products/${product.slug}`)
      }
    }
    catch {
      // Public catalog is optional for the sitemap; static routes still publish.
    }
  }

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...paths.map(path => [
      '  <url>',
      `    <loc>${escapeXml(siteCanonical(origin, path))}</loc>`,
      '  </url>',
    ].join('\n')),
    '</urlset>',
    '',
  ].join('\n')

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return body
})
