import { describe, expect, it } from 'vitest'
import { qrSvg } from '../../utils/qr'
import {
  createDevicePublicCode,
  devicePagePath,
  isDeviceAssignmentHolding,
  isDevicePublicCode,
  mergeBagContentsWithAddons,
  normalizeDevicePublicCode,
  parseBagContents,
  rentalCodeMatchesAssignment,
  resolveBagContents,
  toPublicDeviceLockedPreview,
  toPublicDevicePage,
  toPublicRegisteredDevice,
} from '../../utils/registered-device'
import { registeredDeviceInputSchema, unlockDeviceSchema } from '../../utils/registered-device-validation'

describe('registered devices', () => {
  it('builds a permanent public code and path', () => {
    const code = createDevicePublicCode()
    expect(isDevicePublicCode(code)).toBe(true)
    expect(normalizeDevicePublicCode(` ${code.toUpperCase()} `)).toBe(code)
    expect(devicePagePath(code)).toBe(`/devices/${code}`)
    const branded = qrSvg(`https://jryrentals.com${devicePagePath(code)}`, { withLogo: true })
    expect(branded).toContain('<svg')
    expect(branded).toContain('/logo.png')
    expect(branded).toContain('<image')
  })

  it('rejects invalid device codes', () => {
    expect(isDevicePublicCode('jry-abc123')).toBe(false)
    expect(isDevicePublicCode('device-12345678')).toBe(false)
  })

  it('uses device bag contents over product accessories', () => {
    expect(resolveBagContents(['Router', 'Cable'], ['Kit item'])).toEqual(['Router', 'Cable'])
    expect(resolveBagContents([], ['Stand', 'Tripod'])).toEqual(['Stand', 'Tripod'])
    expect(parseBagContents(['  ', 'Lens', null])).toEqual(['Lens'])
  })

  it('merges rental add-ons into bag contents without duplicates', () => {
    expect(mergeBagContentsWithAddons(
      ['Dish', 'Router'],
      ['Tripod', 'router', 'Extra battery × 2'],
    )).toEqual(['Dish', 'Router', 'Tripod', 'Extra battery × 2'])
  })

  it('maps admin and public payloads without database ids', () => {
    const row = {
      uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      public_code: 'jry-dev-abcdefghij',
      label: 'Starlink Mini Bag A',
      asset_code: 'SL-001',
      serial_number: 'SN-9',
      condition: 'good',
      status: 'available' as const,
      bag_pin: '4321',
      wifi_name: 'JRY-Mini-A',
      wifi_password: 'secretwifi',
      bag_contents: ['Dish', 'Router'],
      notes: null,
      updated_at: null,
      products: {
        uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        name: 'Starlink Mini',
        sku: 'STAR-MINI',
        included_accessories: ['Default kit'],
      },
    }

    const admin = toPublicRegisteredDevice(row, {
      siteUrl: 'https://jryrentals.com',
      usageCount: 3,
      assignment: {
        uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        assigned_at: '2026-11-20T02:00:00.000Z',
        released_at: null,
        rental_requests: {
          uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
          code: 'JRY-20261120-00001',
          starts_on: '2026-11-20',
          ends_on: '2026-11-22',
          status: 'active',
          profiles: { first_name: 'Ana', last_name: 'Cruz' },
        },
      },
    })

    expect(admin).toMatchObject({
      uuid: row.uuid,
      publicCode: 'jry-dev-abcdefghij',
      pageUrl: 'https://jryrentals.com/devices/jry-dev-abcdefghij',
      bagContents: ['Dish', 'Router'],
      usageCount: 3,
      assignment: {
        customerName: 'Ana Cruz',
        rentalCode: 'JRY-20261120-00001',
      },
    })
    expect(JSON.stringify(admin)).not.toMatch(/"id":/)

    const page = toPublicDevicePage(row, {
      uuid: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      assigned_at: '2026-11-20T02:00:00.000Z',
      released_at: null,
      rental_requests: {
        uuid: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
        code: 'JRY-20261120-00001',
        starts_on: '2026-11-20',
        ends_on: '2026-11-22',
        status: 'active',
        profiles: { first_name: 'Ana', last_name: 'Cruz' },
      },
    })
    expect(page.booking?.customerName).toBe('Ana Cruz')
    expect(page.bagPin).toBe('4321')
    expect(page.wifiPassword).toBe('secretwifi')
  })

  it('validates device create payloads', () => {
    expect(registeredDeviceInputSchema.parse({
      productUuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      label: 'Bag A',
      assetCode: 'BAG-A',
      bagContents: ['Router'],
    }).assetCode).toBe('BAG-A')
  })

  it('frees devices after the rental window while still allowing past usage records', () => {
    const now = new Date('2026-11-25T12:00:00+08:00')
    expect(isDeviceAssignmentHolding({
      status: 'active',
      ends_on: '2026-11-26',
      return_at: '2026-11-26T05:00:00.000Z',
    }, now)).toBe(true)
    expect(isDeviceAssignmentHolding({
      status: 'completed',
      ends_on: '2026-11-20',
      return_at: '2026-11-20T05:00:00.000Z',
    }, now)).toBe(false)
    expect(isDeviceAssignmentHolding({
      status: 'active',
      ends_on: '2026-11-20',
      return_at: '2026-11-20T05:00:00.000Z',
    }, now)).toBe(false)
  })

  it('matches unlock booking codes to the assigned rental only', () => {
    expect(rentalCodeMatchesAssignment('jry-20261120-00001', 'JRY-20261120-00001')).toBe(true)
    expect(rentalCodeMatchesAssignment('LUM-20261120-00001', 'JRY-20261120-00001')).toBe(true)
    expect(rentalCodeMatchesAssignment('JRY-20261120-00099', 'JRY-20261120-00001')).toBe(false)
    expect(unlockDeviceSchema.parse({ rentalCode: ' jry-20261120-00001 ' }).rentalCode).toBe('JRY-20261120-00001')
    expect(() => unlockDeviceSchema.parse({ rentalCode: 'not-a-code' })).toThrow()
  })

  it('locks the public preview without bag or Wi‑Fi secrets', () => {
    const preview = toPublicDeviceLockedPreview({
      uuid: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      public_code: 'jry-dev-abcdefghij',
      label: 'Starlink Mini Bag A',
      asset_code: 'SL-001',
      serial_number: 'SN-9',
      condition: 'good',
      status: 'available',
      bag_pin: '4321',
      wifi_name: 'JRY-Mini-A',
      wifi_password: 'secretwifi',
      bag_contents: ['Dish'],
      notes: null,
      updated_at: null,
      products: {
        uuid: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        name: 'Starlink Mini',
        sku: 'STAR-MINI',
        included_accessories: [],
      },
    })
    expect(preview).toEqual({
      locked: true,
      label: 'Starlink Mini Bag A',
      productName: 'Starlink Mini',
    })
    expect(JSON.stringify(preview)).not.toMatch(/4321|secretwifi|Dish/)
  })
})
