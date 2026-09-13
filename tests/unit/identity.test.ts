import { describe, expect, it } from 'vitest'
import {
  IDENTITY_IMAGE_MAX_BYTES,
  identityImageExtension,
  isIdentityImageType,
  toPublicRentalIdentity,
} from '../../utils/identity'

describe('identity documents', () => {
  it('accepts rental ID photo types and rejects others', () => {
    expect(isIdentityImageType('image/jpeg')).toBe(true)
    expect(isIdentityImageType('image/png')).toBe(true)
    expect(isIdentityImageType('image/webp')).toBe(true)
    expect(isIdentityImageType('application/pdf')).toBe(false)
    expect(identityImageExtension('image/png')).toBe('png')
    expect(IDENTITY_IMAGE_MAX_BYTES).toBe(5 * 1024 * 1024)
  })

  it('never exposes storage paths on the public payload', () => {
    const identity = toPublicRentalIdentity({
      uuid: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      submitted_at: '2026-09-13T13:00:00.000Z',
      government_id_path: 'user/rentals/rental/government-id.jpg',
      selfie_path: 'user/rentals/rental/selfie-with-id.jpg',
    })

    expect(identity).toEqual({
      submittedAt: '2026-09-13T13:00:00.000Z',
      governmentIdUrl: null,
      selfieUrl: null,
    })
    expect(identity).not.toHaveProperty('government_id_path')
    expect(identity).not.toHaveProperty('id')
  })
})
