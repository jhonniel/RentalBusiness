import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { buildWaiverPdf, sanitizeWaiverPdfText, signatureHasInk, waiverPdfFilename, wrapWaiverPdfLines } from '../../server/utils/waiver-pdf'

const securityHeaders = readFileSync(
  resolve(process.cwd(), 'server/middleware/security-headers.ts'),
  'utf8',
)

describe('waiver PDF', () => {
  it('builds a downloadable PDF and keeps WinAnsi-safe text', () => {
    expect(sanitizeWaiverPdfText('\u201CAgreement\u201D \u2014 Renter\u2019s copy\u2026')).toBe('"Agreement" - Renter\'s copy...')
    expect(waiverPdfFilename(['JRY-waiver', 'LUM-20260913-00001', 'JRY-WAIVER-v1.0'])).toBe(
      'JRY-waiver-LUM-20260913-00001-JRY-WAIVER-v1.0.pdf',
    )
    expect(wrapWaiverPdfLines('Short line', () => 10, 100)).toEqual(['Short line'])
  })

  it('draws a signature that has ink and skips a blank pad', async () => {
    const signed = await sharp({
      create: {
        width: 40,
        height: 20,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    }).composite([{
      input: await sharp({
        create: {
          width: 24,
          height: 4,
          channels: 4,
          background: { r: 28, g: 25, b: 23, alpha: 1 },
        },
      }).png().toBuffer(),
      left: 8,
      top: 8,
    }]).png().toBuffer()
    const blank = await sharp({
      create: {
        width: 40,
        height: 20,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    }).png().toBuffer()
    const signedUrl = `data:image/png;base64,${signed.toString('base64')}`
    const blankUrl = `data:image/png;base64,${blank.toString('base64')}`

    expect(await signatureHasInk(signedUrl)).toBe(true)
    expect(await signatureHasInk(blankUrl)).toBe(false)

    const withSignature = await buildWaiverPdf({
      title: 'Equipment Rental Agreement & Liability Waiver',
      version: 'JRY-WAIVER-v1.2',
      body: 'You are responsible for the rented equipment.',
      filename: 'JRY-waiver-signed.pdf',
      signatureDataUrl: signedUrl,
    })
    const withoutInk = await buildWaiverPdf({
      title: 'Equipment Rental Agreement & Liability Waiver',
      version: 'JRY-WAIVER-v1.2',
      body: 'You are responsible for the rented equipment.',
      filename: 'JRY-waiver-blank.pdf',
      signatureDataUrl: blankUrl,
    })
    expect(withSignature.byteLength).toBeGreaterThan(withoutInk.byteLength)
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

  it('allows the admin PDF preview to render a same-origin blob', () => {
    expect(securityHeaders).toContain("frame-src \\'self\\' blob:")
    expect(securityHeaders).toContain("object-src \\'self\\' blob:")
    expect(securityHeaders).toContain("frame-ancestors \\'none\\'")
  })
})
