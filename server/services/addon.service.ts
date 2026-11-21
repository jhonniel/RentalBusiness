import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../../types/database.types'
import type { AdminAddonListResponse, PublicAddon, PublicAddonOffer, RentalAddonQuoteLine, RentalAddonSelection } from '../../types/addon'
import type { AddonInput } from '../../utils/addon-validation'
import { quoteAddonLine, sumAddonQuoteLines, toPublicAddon, toPublicAddonOffer } from '../../utils/addon'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import {
  archiveAddon,
  createAddon,
  findAddonByUuid,
  findAddonsByUuids,
  insertRentalAddonItem,
  listAddons,
  listLinkedAddonUuidsForProduct,
  listLinkedAddonsForProduct,
  replaceProductAddonLinks,
  updateAddon,
} from '../repositories/addon.repository'

type Client = SupabaseClient<Database>

export async function getAdminAddons(client: Client): Promise<AdminAddonListResponse> {
  const rows = await listAddons(client, { includeArchived: true })
  return rows === null
    ? { items: [], ready: false }
    : { items: rows.map(toPublicAddon), ready: true }
}

export async function saveAddon(event: H3Event, client: Client, input: AddonInput, uuid?: string) {
  const previous = uuid ? await findAddonByUuid(client, uuid) : null
  if (uuid && !previous) {
    throw new AppError('Add-on not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const row = uuid ? await updateAddon(client, uuid, input) : await createAddon(client, input)
  const next = toPublicAddon(row)

  await recordAudit(event, client, {
    action: uuid ? 'addon.update' : 'addon.create',
    entity: 'addons',
    entityId: next.uuid,
    previous: previous ? toPublicAddon(previous) as unknown as Json : undefined,
    next: next as unknown as Json,
  })

  return next
}

export async function archiveAddonByUuid(event: H3Event, client: Client, uuid: string) {
  const previous = await findAddonByUuid(client, uuid)
  if (!previous) {
    throw new AppError('Add-on not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const row = await archiveAddon(client, uuid)
  const next = toPublicAddon(row)

  await recordAudit(event, client, {
    action: 'addon.archive',
    entity: 'addons',
    entityId: uuid,
    previous: toPublicAddon(previous) as unknown as Json,
    next: next as unknown as Json,
  })

  return next
}

export async function getProductAddonOffers(
  client: Client,
  productId: number,
  options: { bookableOnly?: boolean } = {},
): Promise<PublicAddonOffer[]> {
  const rows = await listLinkedAddonsForProduct(client, productId, options)
  if (rows === null) {
    return []
  }
  return rows.map(toPublicAddonOffer)
}

export async function getProductLinkedAddonUuids(client: Client, productId: number): Promise<string[]> {
  return (await listLinkedAddonUuidsForProduct(client, productId)) ?? []
}

export async function setProductAddonLinks(
  event: H3Event,
  client: Client,
  product: { id: number, uuid: string },
  addonUuids: string[],
) {
  const linked = await replaceProductAddonLinks(client, product.id, addonUuids)
  await recordAudit(event, client, {
    action: 'product.addons',
    entity: 'products',
    entityId: product.uuid,
    next: { addonUuids: linked } as unknown as Json,
  })
  return linked
}

export async function quoteSelectedAddons(
  client: Client,
  productId: number,
  selections: RentalAddonSelection[],
): Promise<{ lines: RentalAddonQuoteLine[], total: number }> {
  if (!selections.length) {
    return { lines: [], total: 0 }
  }

  const linked = await listLinkedAddonsForProduct(client, productId, { bookableOnly: true })
  if (linked === null) {
    throw new AppError(ADDON_SETUP_FROM_REPO(), 409, ERROR_CODES.CONFLICT)
  }

  const linkedByUuid = new Map(linked.map(row => [row.uuid, row]))
  const seen = new Set<string>()
  const lines: RentalAddonQuoteLine[] = []

  for (const selection of selections) {
    if (seen.has(selection.uuid)) {
      throw new AppError('Each add-on can only be selected once.', 400, ERROR_CODES.VALIDATION_ERROR)
    }
    seen.add(selection.uuid)

    const addon = linkedByUuid.get(selection.uuid)
    if (!addon || !addon.bookable || addon.status !== 'active') {
      throw new AppError('That add-on is not available on this kit.', 409, ERROR_CODES.CONFLICT)
    }

    const available = Number(addon.available ?? 0)
    if (selection.quantity > available) {
      throw new AppError(
        available < 1
          ? `${addon.name} is not available right now.`
          : `Only ${available} of ${addon.name} left.`,
        409,
        ERROR_CODES.CONFLICT,
      )
    }

    const priced = quoteAddonLine({
      unitPrice: Number(addon.unit_price),
      quantity: selection.quantity,
    })

    lines.push({
      uuid: addon.uuid,
      name: addon.name,
      quantity: priced.quantity,
      unitPrice: priced.unitPrice,
      lineTotal: priced.lineTotal,
      available,
    })
  }

  return { lines, total: sumAddonQuoteLines(lines) }
}

function ADDON_SETUP_FROM_REPO() {
  return 'Paste the product add-ons SQL in Supabase to turn on add-ons.'
}

export async function persistRentalAddonLines(
  client: Client,
  rentalId: number,
  lines: RentalAddonQuoteLine[],
) {
  if (!lines.length) {
    return
  }

  const rows = await findAddonsByUuids(client, lines.map(line => line.uuid))
  const byUuid = new Map(rows.map(row => [row.uuid, row]))

  for (const line of lines) {
    const addon = byUuid.get(line.uuid)
    if (!addon?.id) {
      throw new AppError('Add-on not found.', 404, ERROR_CODES.NOT_FOUND)
    }
    await insertRentalAddonItem(client, {
      rental_id: rentalId,
      addon_id: Number(addon.id),
      quantity: line.quantity,
      unit_price: line.unitPrice,
      line_total: line.lineTotal,
    })
  }
}

export async function listActiveAddonsForAdminSelect(client: Client): Promise<PublicAddon[]> {
  const rows = await listAddons(client, { includeArchived: false })
  return (rows ?? []).map(toPublicAddon)
}
