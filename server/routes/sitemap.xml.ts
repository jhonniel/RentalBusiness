import { listCategories } from '../repositories/category.repository'
import { listSitemapProducts } from '../repositories/product.repository'
import { getPublicSupabaseClient, isSupabaseConfigured } from '../utils/supabase'
import { publicSitemapPaths, renderSitemap, siteCanonical } from '../../utils/seo'

export default defineEventHandler(async (event) => {
  const origin = String(useRuntimeConfig().public.siteUrl || 'http://localhost:3000')
  const urls: Array<{ loc: string, lastmod?: string | null }> = publicSitemapPaths().map(path => ({ loc: siteCanonical(origin, path) }))

  if (isSupabaseConfigured()) {
    try {
      const client = await getPublicSupabaseClient(event)
      const [products, categories] = await Promise.all([
        listSitemapProducts(client),
        listCategories(client).catch(() => []),
      ])
      for (const category of categories) {
        if (category.is_active && category.slug) {
          urls.push({ loc: siteCanonical(origin, `/products?category=${encodeURIComponent(category.slug)}`) })
        }
      }
      for (const product of products) {
        urls.push({
          loc: siteCanonical(origin, `/products/${product.slug}`),
          lastmod: product.updated_at,
        })
      }
    }
    catch {
      // Public catalog is optional for the sitemap; static routes still publish.
    }
  }

  setHeader(event, 'content-type', 'application/xml; charset=utf-8')
  return renderSitemap(urls)
})
