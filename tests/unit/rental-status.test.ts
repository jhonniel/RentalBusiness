import { describe, expect, it } from 'vitest'
import {
  canTransitionRentalStatus,
  datesOverlapInclusive,
  rentalOccupiesInventory,
} from '../../utils/rental-status'

describe('rental status transitions', () => {
  it('allows the pickup path and forbids skipping ahead', () => {
    expect(canTransitionRentalStatus('pending', 'approved')).toBe(true)
    expect(canTransitionRentalStatus('approved', 'ready_for_pickup')).toBe(true)
    expect(canTransitionRentalStatus('draft', 'active')).toBe(false)
    expect(canTransitionRentalStatus('completed', 'active')).toBe(false)
  })

  it('treats completed, cancelled, and rejected as terminal', () => {
    expect(canTransitionRentalStatus('cancelled', 'pending')).toBe(false)
    expect(canTransitionRentalStatus('rejected', 'approved')).toBe(false)
  })
})

describe('inventory occupancy', () => {
  it('reserves stock for open rentals and releases completed ones', () => {
    expect(rentalOccupiesInventory('approved')).toBe(true)
    expect(rentalOccupiesInventory('active')).toBe(true)
    expect(rentalOccupiesInventory('cancelled')).toBe(false)
    expect(rentalOccupiesInventory('returned')).toBe(false)
  })
})

describe('inclusive date overlap', () => {
  it('detects the Sept 10-12 vs Sept 11-13 conflict', () => {
    expect(datesOverlapInclusive('2026-09-10', '2026-09-12', '2026-09-11', '2026-09-13')).toBe(true)
    expect(datesOverlapInclusive('2026-09-10', '2026-09-12', '2026-09-13', '2026-09-15')).toBe(false)
  })
})
