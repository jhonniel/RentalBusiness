import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { formatMoney } from '../../utils/currency'
import { firstWaiverAcceptance, isSignatureDataUrl, renderWaiverBody, toPublicWaiverAcceptance, toPublicWaiverVersion, adminSignedWaiverPath, adminSignedWaiverUrl, waiverDisplayLines } from '../../utils/waiver'
import { acceptAdminWaiverSchema, acceptWaiverSchema, publishWaiverSchema } from '../../utils/waiver-validation'

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
    expect(acceptAdminWaiverSchema.parse({
      waiverVersionUuid: '88888888-8888-4888-8888-888888888888',
      signerName: 'Kimberly Monta',
      signatureData: signatureData(),
    })).toMatchObject({
      signerName: 'Kimberly Monta',
    })
    expect(acceptAdminWaiverSchema.safeParse({
      waiverVersionUuid: '88888888-8888-4888-8888-888888888888',
      signerName: 'Kimberly Monta',
      signatureData: signatureData(),
      rentalId: 9,
    }).success).toBe(false)
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

  it('builds an admin-only signed waiver URL from the rental uuid', () => {
    expect(adminSignedWaiverPath('66666666-6666-4666-8666-666666666666')).toBe(
      '/admin/rentals/66666666-6666-4666-8666-666666666666/waiver',
    )
    expect(adminSignedWaiverUrl('https://jry.test/', '66666666-6666-4666-8666-666666666666')).toBe(
      'https://jry.test/admin/rentals/66666666-6666-4666-8666-666666666666/waiver',
    )
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

  it('lists deposit, late fee, and replacement value with the rental equipment', () => {
    const body = renderWaiverBody(
      'Equipment on this rental:\n{{RENTAL_EQUIPMENT}}\n',
      [{
        quantity: 1,
        product: {
          name: 'Starlink Mini',
          depositAmount: 8000,
          lateFee: 500,
          replacementValue: 28000,
        },
      }],
    )

    expect(body).toContain('- Starlink Mini × 1')
    expect(body).toContain('Deposit:')
    expect(body).toContain(formatMoney(8000))
    expect(body).toContain('Late fee:')
    expect(body).toContain(formatMoney(500))
    expect(body).toContain('per day')
    expect(body).toContain('Replacement value:')
    expect(body).toContain(formatMoney(28000))

    const scheduled = renderWaiverBody(
      'Agreement version: JRY-WAIVER-v1.2\nEquipment on this rental:\n{{RENTAL_EQUIPMENT}}\n',
      [{
        quantity: 1,
        product: {
          name: 'Starlink Mini',
          depositAmount: 8000,
          lateFee: 300,
          replacementValue: 28000,
        },
      }],
    )
    expect(scheduled).toContain('This applies once the equipment is not returned by the agreed return time.')
    expect(scheduled).toContain(`Less than 6 hours after the return time: ${formatMoney(300)}.`)
    expect(scheduled).toContain('6 hours or more, and up to 12 hours, after the return time: half a day of the rented item.')
    expect(scheduled).toContain('More than 12 hours after the return time: charged as 1 day of rent.')
    expect(scheduled).not.toContain('per day')
  })

  it('shows only the rented equipment clause and bolds that equipment', () => {
    const source = readFileSync(resolve(process.cwd(), 'supabase/waiver-jry-v1.txt'), 'utf8')
    const starlink = renderWaiverBody(source, [{ quantity: 1, product: { name: 'Starlink Mini' } }])
    const drone = renderWaiverBody(source, [{ quantity: 1, product: { name: 'DJI Air 3' } }])
    const camera = renderWaiverBody(source, [{ quantity: 1, product: { name: 'DJI Osmo 360' } }])

    expect(starlink).toContain('7. STARLINK MINI')
    expect(starlink).toContain('8. PERSONAL DATA AND RECORDED CONTENT')
    expect(starlink).not.toContain('DRONE RENTAL')
    expect(starlink).not.toContain('CAMERA EQUIPMENT')
    expect(starlink).toContain('12. LATE RETURN')
    expect(starlink).toContain('charged under section 12.')
    expect(drone).toContain('7. DRONE RENTAL')
    expect(drone).not.toContain('STARLINK MINI')
    expect(drone).not.toContain('CAMERA EQUIPMENT')
    expect(camera).toContain('7. CAMERA EQUIPMENT')
    expect(camera).not.toContain('DRONE RENTAL')
    expect(camera).not.toContain('STARLINK MINI')
    expect(waiverDisplayLines('- Starlink Mini × 1')).toEqual([[
      { text: '- ', bold: false },
      { text: 'Starlink Mini', bold: true },
      { text: ' × 1', bold: false },
    ]])
  })
})

describe('waiver down payment refund', () => {
  it('requires a current v1.2 source with the late-return schedule', () => {
    const source = readFileSync(resolve(process.cwd(), 'supabase/waiver-jry-v1.txt'), 'utf8')

    expect(source).toContain('Agreement version: JRY-WAIVER-v1.2')
    expect(source).toContain('16. DOWN PAYMENT AND REFUND')
    expect(source).toContain('The down payment is not refundable once the Renter has booked the rental.')
    expect(source).toContain('A late fee applies once the equipment is not returned by the agreed return time.')
    expect(source).toContain('Less than 6 hours after the return time, the late fee is ₱300.00.')
    expect(source).toContain('6 hours or more, and up to 12 hours, after the return time, the late fee is half a day of the rented item.')
    expect(source).toContain('More than 12 hours after the return time, the late return is charged as 1 day of rent.')
    expect(source).not.toContain('Agreement version: JRY-WAIVER-v1.1')
  })
})
