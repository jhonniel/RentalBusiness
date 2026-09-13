import { describe, expect, it } from 'vitest'
import { STORAGE_BUCKETS, publicStorageUrl } from '../../utils/storage'

describe('public storage urls', () => {
  it('builds a public Supabase Storage URL', () => {
    expect(publicStorageUrl(
      'https://example.supabase.co/',
      STORAGE_BUCKETS.productImages,
      'abc/cover.png',
    )).toBe('https://example.supabase.co/storage/v1/object/public/product-images/abc/cover.png')
  })
})
