import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AppError, ERROR_CODES } from './errors'

export type LegalDocumentName = 'terms-jry-v1.txt' | 'privacy-jry-v1.txt'

function asText(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) {
    return value.trim()
  }

  if (Buffer.isBuffer(value) && value.byteLength) {
    return value.toString('utf8').trim()
  }

  return null
}

export async function readLegalDocument(filename: LegalDocumentName): Promise<string> {
  const storage = useStorage('assets:legal')
  const bundled = asText(await storage.getItem(filename))
    || asText(await storage.getItem(`legal/${filename}`))
  if (bundled) {
    return bundled
  }

  try {
    return readFileSync(resolve(process.cwd(), 'supabase', filename), 'utf8').trim()
  }
  catch (cause) {
    throw new AppError(
      'This policy is not available.',
      503,
      ERROR_CODES.INTERNAL_ERROR,
      { cause },
    )
  }
}
