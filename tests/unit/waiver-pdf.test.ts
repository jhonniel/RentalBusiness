import { describe, expect, it } from 'vitest'
import { buildWaiverPdf, sanitizeWaiverPdfText, waiverPdfFilename, wrapWaiverPdfLines } from '../../server/utils/waiver-pdf'

describe('waiver PDF', () => {
  it('builds a downloadable PDF and keeps WinAnsi-safe text', () => {
    expect(sanitizeWaiverPdfText('\u201CAgreement\u201D \u2014 Renter\u2019s copy\u2026')).toBe('"Agreement" - Renter\'s copy...')
    expect(waiverPdfFilename(['JRY-waiver', 'LUM-20260913-00001', 'JRY-WAIVER-v1.0'])).toBe(
      'JRY-waiver-LUM-20260913-00001-JRY-WAIVER-v1.0.pdf',
    )
    expect(wrapWaiverPdfLines('Short line', () => 10, 100)).toEqual(['Short line'])
  })

  it('writes a PDF document with the waiver title', async () => {
    const bytes = await buildWaiverPdf({
      title: 'Equipment Rental Agreement & Liability Waiver',
      version: 'JRY-WAIVER-v1.0',
      body: 'You are responsible for the rented equipment from pickup until return.\nKeep the kit dry.',
      filename: 'JRY-waiver-demo.pdf',
      rentalCode: 'LUM-20260913-00001',
      startsOn: '2026-09-20',
      endsOn: '2026-09-22',
      signerName: 'Ana Reyes',
      acceptedAt: '2026-09-13T00:00:00.000Z',
    })
    const header = Buffer.from(bytes.slice(0, 5)).toString('utf8')
    expect(header).toBe('%PDF-')
    expect(bytes.byteLength).toBeGreaterThan(500)
  })
})
