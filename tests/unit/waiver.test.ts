import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { firstWaiverAcceptance, isSignatureDataUrl, renderWaiverBody, toPublicWaiverAcceptance, toPublicWaiverVersion } from '../../utils/waiver'
import { acceptWaiverSchema, publishWaiverSchema } from '../../utils/waiver-validation'

function signatureData(length = 2600) {
  return `data:image/png;base64,${'A'.repeat(length)}==`
}

describe('waiver validation', () => {
  it('accepts a customer signature and rejects privileged fields', () => {
    expect(acceptWaiverSchema.parse({
      rentalUuid: '66666666-6666-4666-8666-666666666666',
      waiverVersionUuid: '88888888-8888-4888-8888-888888888888',
      signerName: 'Ana Reyes',
      signatureData: signatureData(),
    })).toMatchObject({
      signerName: 'Ana Reyes',
    })

    expect(acceptWaiverSchema.safeParse({
      rentalUuid: '66666666-6666-4666-8666-666666666666',
      waiverVersionUuid: '88888888-8888-4888-8888-888888888888',
      signerName: 'Ana Reyes',
      signatureData: signatureData(),
      id: 3,
      ipAddress: '1.1.1.1',
      userAgent: 'test',
    }).success).toBe(false)
  })

  it('rejects a blank or oversized signature', () => {
    expect(isSignatureDataUrl('data:image/png;base64,AAAA')).toBe(false)
    expect(isSignatureDataUrl(`data:image/png;base64,${'A'.repeat(260_000)}==`)).toBe(false)
    expect(isSignatureDataUrl(signatureData())).toBe(true)
  })

  it('requires a rental identifier and a unique version string', () => {
    expect(acceptWaiverSchema.safeParse({
      waiverVersionUuid: '88888888-8888-4888-8888-888888888888',
      signerName: 'Ana Reyes',
      signatureData: signatureData(),
    }).success).toBe(false)

    expect(publishWaiverSchema.parse({
      version: 'JRY-WAIVER-v1.0',
      title: 'Equipment Rental Agreement & Liability Waiver',
      body: 'You are responsible for the rented equipment from pickup until return.',
    }).version).toBe('JRY-WAIVER-v1.0')

    expect(publishWaiverSchema.safeParse({
      version: 'JRY-WAIVER-v1.1',
      title: 'Equipment Rental Agreement & Liability Waiver',
      body: `${'A'.repeat(21_000)}`,
    }).success).toBe(true)
  })
})

describe('waiver mapper', () => {
  it('never includes internal ids, ip, or user agent', () => {
    const acceptance = toPublicWaiverAcceptance({
      uuid: '99999999-9999-4999-8999-999999999999',
      signer_name: 'Ana Reyes',
      accepted_at: '2026-09-13T00:00:00.000Z',
      waiver_versions: {
        uuid: '88888888-8888-4888-8888-888888888888',
        version: '2026.09.1',
        title: 'Lumen Equipment Rental Waiver',
        body: 'You are responsible for the rented equipment.',
      },
    })

    expect(acceptance.privacyPolicyVersion).toBeNull()
    expect(acceptance.termsVersion).toBeNull()
    expect(acceptance.signerEmail).toBeNull()
    expect(acceptance.signerPhone).toBeNull()
    expect(acceptance).not.toHaveProperty('id')
    expect(acceptance).not.toHaveProperty('ip_address')
    expect(acceptance).not.toHaveProperty('userAgent')
    expect(acceptance.version).not.toHaveProperty('id')
    expect(firstWaiverAcceptance(null)).toBeNull()
    expect(toPublicWaiverVersion({
      uuid: '88888888-8888-4888-8888-888888888888',
      version: '2026.09.1',
      title: 'Lumen Equipment Rental Waiver',
      body: 'You are responsible for the rented equipment.',
      is_current: true,
      published_at: '2026-09-13T00:00:00.000Z',
    })).not.toHaveProperty('id')
  })

  it('shows only the products on the rental in the equipment list', () => {
    const items = [{ quantity: 1, product: { name: 'DJI Air 3' } }]

    expect(renderWaiverBody(
      'Equipment on this rental:\n{{RENTAL_EQUIPMENT}}\n\nKeep the kit secure.',
      items,
    )).toContain('- DJI Air 3 × 1')
    expect(renderWaiverBody(
      'Equipment on this rental:\n{{RENTAL_EQUIPMENT}}\n\nKeep the kit secure.',
      items,
    )).not.toContain('Starlink Mini')

    const published = renderWaiverBody(
      'Equipment may include, but is not limited to:\n- Starlink Mini\n- DJI Mini 3\n- DJI Osmo 360\n- Accessories and related rental equipment\n\n3. RESPONSIBILITY',
      items,
    )
    expect(published).toContain('Equipment on this rental:')
    expect(published).toContain('- DJI Air 3 × 1')
    expect(published).not.toContain('Starlink Mini')
    expect(published).not.toContain('DJI Osmo 360')
  })
})

describe('waiver down payment refund', () => {
  it('requires a current v1.1 source that freezes the down payment after booking', () => {
    const source = readFileSync(resolve(process.cwd(), 'supabase/waiver-jry-v1.txt'), 'utf8')

    expect(source).toContain('Agreement version: JRY-WAIVER-v1.1')
    expect(source).toContain('16. DOWN PAYMENT AND REFUND')
    expect(source).toContain('The down payment is not refundable once the Renter has booked the rental.')
    expect(source).toContain('They understand that the down payment is not refundable once the rental is booked.')
    expect(source).not.toContain('Agreement version: JRY-WAIVER-v1.0')
  })
})
