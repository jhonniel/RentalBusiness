import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { AppError, ERROR_CODES } from './errors'

export type LegalDocumentName = 'terms-jry-v1.txt' | 'privacy-jry-v1.txt'

export async function readLegalDocument(filename: LegalDocumentName): Promise<string> {
  const storage = useStorage('assets:legal')
  const fromBundle = await storage.getItem<string>(filename)
  if (typeof fromBundle === 'string' && fromBundle.trim()) {
    return fromBundle.trim()
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
