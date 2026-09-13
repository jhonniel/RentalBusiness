export const STORAGE_BUCKETS = {
  productImages: 'product-images',
  paymentQr: 'payment-qr-images',
  privateDocuments: 'private-documents',
} as const

export function publicStorageUrl(supabaseUrl: string, bucket: string, storagePath: string): string {
  return `${supabaseUrl.replace(/\/$/, '')}/storage/v1/object/public/${bucket}/${storagePath}`
}
