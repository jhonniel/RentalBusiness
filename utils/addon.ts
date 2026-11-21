import type { AddonStatus, PublicAddon, PublicAddonOffer, PublicRentalAddonItem, RentalAddonQuoteLine } from '~/types/addon'
import { fromMinorUnits, toMinorUnits } from './currency'

export interface AddonRow {
  id?: number
  uuid: string
  name: string
  description: string
  unit_price: number
  quantity: number
  bookable: boolean
  status: AddonStatus
  updated_at?: string | null
  held_quantity?: number | null
  available?: number | null
}

export interface RentalAddonItemRow {
  uuid: string
  quantity: number
  unit_price: number
  line_total: number
  addons: {
    uuid: string
    name: string
  } | {
    uuid: string
    name: string
  }[] | null
}

export function quoteAddonLine(input: {
  unitPrice: number
  quantity: number
}) {
  const quantity = Math.max(1, Math.trunc(input.quantity))
  const unitPrice = Math.max(0, Number(input.unitPrice))
  // Flat fee for the whole booking — not multiplied by days or hours.
  const lineTotal = fromMinorUnits(toMinorUnits(unitPrice) * quantity)
  return {
    unitPrice,
    quantity,
    lineTotal,
  }
}

export function toPublicAddon(row: AddonRow): PublicAddon {
  const quantity = Number(row.quantity)
  const held = Math.max(0, Number(row.held_quantity ?? 0))
  const available = row.available === null || row.available === undefined
    ? Math.max(0, quantity - held)
    : Math.max(0, Number(row.available))
  return {
    uuid: row.uuid,
    name: row.name,
    description: row.description ?? '',
    unitPrice: Number(row.unit_price),
    quantity,
    heldQuantity: held,
    available,
    bookable: Boolean(row.bookable),
    status: row.status === 'archived' ? 'archived' : 'active',
    updatedAt: row.updated_at ?? null,
  }
}

export function toPublicAddonOffer(row: AddonRow): PublicAddonOffer {
  const addon = toPublicAddon(row)
  return {
    uuid: addon.uuid,
    name: addon.name,
    description: addon.description,
    unitPrice: addon.unitPrice,
    available: addon.available,
    bookable: addon.bookable,
  }
}

export function toPublicRentalAddonItem(row: RentalAddonItemRow): PublicRentalAddonItem {
  const addon = Array.isArray(row.addons) ? row.addons[0] : row.addons
  if (!addon) {
    throw new Error('Rental add-on item is missing an add-on.')
  }
  return {
    uuid: row.uuid,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    lineTotal: Number(row.line_total),
    addon: {
      uuid: addon.uuid,
      name: addon.name,
    },
  }
}

export function sumAddonQuoteLines(lines: RentalAddonQuoteLine[]) {
  return fromMinorUnits(lines.reduce((sum, line) => sum + toMinorUnits(line.lineTotal), 0))
}
