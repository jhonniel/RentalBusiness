import { describe, expect, it } from 'vitest'
import { addCalendarDays } from '../../utils/expense'
import { calendarDateInZone } from '../../utils/datetime'
import { continueAdminRentalSchema } from '../../utils/rental-validation'
import { acceptWaiverInviteSchema, sendWaiverInviteSchema } from '../../utils/waiver-validation'
import {
  canContinueAdminRental,
  canOpenAdminContinue,
  canResetAdminWaiver,
  canSendGuestRentalLink,
  canSendWaiverInvite,
  canUploadGuestIdentity,
  isWaiverInviteOpen,
  isWaiverInviteUnexpired,
  waiverInvitePath,
  waiverInviteUnavailableReason,
  waiverInviteUrl,
} from '../../utils/waiver-invite'
import {
  createWaiverInviteToken,
  hashWaiverInviteToken,
  waiverInviteTokenMatches,
} from '../../server/utils/waiver-invite-token'

function signatureData(length = 2600) {
  return `data:image/png;base64,${'A'.repeat(length)}==`
}

describe('admin continue and waiver invite rules', () => {
  it('lets admins continue only a draft and send a link before the waiver is signed', () => {
    expect(canContinueAdminRental({ status: 'draft' })).toBe(true)
    expect(canContinueAdminRental({ status: 'pending' })).toBe(false)
    expect(canSendWaiverInvite({ status: 'draft', waiver: null })).toBe(true)
    expect(canSendWaiverInvite({ status: 'pending', waiver: null })).toBe(true)
    expect(canSendWaiverInvite({ status: 'awaiting_payment', waiver: null })).toBe(true)
    expect(canSendWaiverInvite({ status: 'draft', waiver: { uuid: 'waiver' } as never })).toBe(false)
    expect(canSendGuestRentalLink({ status: 'draft', waiver: { uuid: 'waiver' } as never })).toBe(true)
    expect(canSendGuestRentalLink({ status: 'cancelled', waiver: { uuid: 'waiver' } as never })).toBe(false)
    expect(canResetAdminWaiver({ status: 'draft', waiver: { uuid: 'waiver' } as never })).toBe(true)
    expect(canResetAdminWaiver({ status: 'paid', waiver: { uuid: 'waiver' } as never })).toBe(true)
    expect(canResetAdminWaiver({ status: 'draft', waiver: null })).toBe(false)
    expect(canResetAdminWaiver({ status: 'cancelled', waiver: { uuid: 'waiver' } as never })).toBe(false)
    expect(canOpenAdminContinue({ status: 'draft', waiver: { uuid: 'waiver' } as never })).toBe(true)
    expect(canOpenAdminContinue({ status: 'paid', waiver: { uuid: 'waiver' } as never })).toBe(true)
    expect(canOpenAdminContinue({ status: 'cancelled', waiver: { uuid: 'waiver' } as never })).toBe(false)
    expect(canSendWaiverInvite({ status: 'cancelled', waiver: null })).toBe(false)
    expect(waiverInviteUnavailableReason({
      status: 'draft',
      waiver: { signerName: 'Kimberly Monta' } as never,
    })).toBeNull()
    expect(waiverInviteUnavailableReason({
      status: 'cancelled',
      waiver: { signerName: 'Kimberly Monta' } as never,
    })).toBe('This waiver is already signed by Kimberly Monta.')
  })

  it('builds a public sign path from uuid and token only', () => {
    expect(waiverInvitePath('11111111-1111-4111-8111-111111111111', 'abc+def')).toBe(
      '/waivers/sign/11111111-1111-4111-8111-111111111111?token=abc%2Bdef',
    )
    expect(waiverInviteUrl('https://jryrentals.online/', '11111111-1111-4111-8111-111111111111', 'token')).toBe(
      'https://jryrentals.online/waivers/sign/11111111-1111-4111-8111-111111111111?token=token',
    )
    expect(isWaiverInviteOpen({
      usedAt: null,
      expiresAt: '2099-01-01T00:00:00.000Z',
    })).toBe(true)
    expect(isWaiverInviteOpen({
      usedAt: '2026-10-05T00:00:00.000Z',
      expiresAt: '2099-01-01T00:00:00.000Z',
    })).toBe(false)
    expect(isWaiverInviteUnexpired({
      expiresAt: '2099-01-01T00:00:00.000Z',
    })).toBe(true)
    expect(canUploadGuestIdentity({ status: 'draft', waiver: { uuid: 'waiver' } as never })).toBe(true)
    expect(canUploadGuestIdentity({ status: 'draft', waiver: null })).toBe(false)
    expect(canUploadGuestIdentity({ status: 'paid', waiver: { uuid: 'waiver' } as never })).toBe(false)
  })
})

describe('waiver invite validation', () => {
  it('accepts an optional email override and a guest signature', () => {
    expect(sendWaiverInviteSchema.parse({})).toEqual({})
    expect(sendWaiverInviteSchema.parse({ email: 'guest@example.com' })).toEqual({
      email: 'guest@example.com',
    })
    expect(sendWaiverInviteSchema.safeParse({ email: 'not-an-email' }).success).toBe(false)
    expect(sendWaiverInviteSchema.safeParse({ rentalId: 9 }).success).toBe(false)

    expect(acceptWaiverInviteSchema.parse({
      token: 'a'.repeat(32),
      waiverVersionUuid: '88888888-8888-4888-8888-888888888888',
      signerName: 'Ana Reyes',
      signatureData: signatureData(),
    })).toMatchObject({
      signerName: 'Ana Reyes',
    })
    expect(acceptWaiverInviteSchema.safeParse({
      token: 'short',
      waiverVersionUuid: '88888888-8888-4888-8888-888888888888',
      signerName: 'Ana Reyes',
      signatureData: signatureData(),
    }).success).toBe(false)
  })

  it('rejects a past start date on the admin continue form', () => {
    const startsOn = addCalendarDays(calendarDateInZone(), 1)
    const endsOn = addCalendarDays(startsOn, 2)

    expect(continueAdminRentalSchema.parse({
      startsOn,
      endsOn,
      quantity: 1,
      firstName: 'Ana',
      lastName: 'Reyes',
    })).toMatchObject({
      firstName: 'Ana',
      lastName: 'Reyes',
    })
    expect(continueAdminRentalSchema.parse({
      startsOn: calendarDateInZone(),
      endsOn: addCalendarDays(calendarDateInZone(), 1),
      pickupTime: '08:00',
      firstName: 'Ana',
      lastName: 'Reyes',
    }).pickupTime).toBe('08:00')
    expect(continueAdminRentalSchema.safeParse({
      startsOn: addCalendarDays(calendarDateInZone(), -1),
      endsOn: addCalendarDays(calendarDateInZone(), -1),
      firstName: 'Ana',
      lastName: 'Reyes',
    }).success).toBe(false)
    expect(continueAdminRentalSchema.safeParse({
      startsOn,
      endsOn,
      firstName: 'Ana',
      lastName: 'Reyes',
      totalAmount: 1,
    }).success).toBe(false)
  })
})

describe('waiver invite tokens', () => {
  it('stores a sha256 hash and compares tokens in constant time', () => {
    const token = createWaiverInviteToken()
    const hash = hashWaiverInviteToken(token)

    expect(token).toHaveLength(43)
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[a-f0-9]+$/)
    expect(hash).not.toContain(token)
    expect(waiverInviteTokenMatches(hash, token)).toBe(true)
    expect(waiverInviteTokenMatches(hash, `${token}x`)).toBe(false)
  })
})
