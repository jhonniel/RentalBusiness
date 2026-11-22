import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../../types/database.types'
import type { AdminAddonListResponse, PublicAddon, PublicAddonOffer, RentalAddonQuoteLine, RentalAddonSelection } from '../../types/addon'
import type { AddonInput } from '../../utils/addon-validation'
import { STORAGE_BUCKETS } from '../../utils/storage'
import { quoteAddonLine, sumAddonQuoteLines, toPublicAddon, toPublicAddonOffer } from '../../utils/addon'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import { compressImageForStorage, type UploadPart } from '../utils/image-compress'
import {
  archiveAddon,
  createAddon,
  deleteRentalAddonItemsByRentalId,
  findAddonByUuid,
  findAddonsByUuids,
  insertRentalAddonItem,
  listAddons,
  listLinkedAddonUuidsForProduct,
  listLinkedAddonsForProduct,
  listRentalAddonItems,
  replaceProductAddonLinks,
  updateAddon,
  updateAddonImagePath,
} from '../repositories/addon.repository'

type Client = SupabaseClient<Database>

const ADDON_IMAGE_BUCKET = STORAGE_BUCKETS.addonImages

function supabaseUrl() {
  const config = useRuntimeConfig()
  return config.public.supabaseUrl || process.env.NUXT_PUBLIC_SUPABASE_URL || ''
}

function asPublic(row: Parameters<typeof toPublicAddon>[0]) {
  return toPublicAddon(row, supabaseUrl())
}

export async function getAdminAddons(client: Client): Promise<AdminAddonListResponse> {
  const rows = await listAddons(client, { includeArchived: true })
  return rows === null
    ? { items: [], ready: false }
    : { items: rows.map(asPublic), ready: true }
}

export async function saveAddon(event: H3Event, client: Client, input: AddonInput, uuid?: string) {
  const previous = uuid ? await findAddonByUuid(client, uuid) : null
  if (uuid && !previous) {
    throw new AppError('Add-on not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const row = uuid ? await updateAddon(client, uuid, input) : await createAddon(client, input)
  const next = asPublic(row)

  await recordAudit(event, client, {
    action: uuid ? 'addon.update' : 'addon.create',
    entity: 'addons',
    entityId: next.uuid,
    previous: previous ? asPublic(previous) as unknown as Json : undefined,
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
  const next = asPublic(row)

  await recordAudit(event, client, {
    action: 'addon.archive',
    entity: 'addons',
    entityId: uuid,
    previous: asPublic(previous) as unknown as Json,
    next: next as unknown as Json,
  })

  return next
}

export async function uploadAddonImage(
  event: H3Event,
  client: Client,
  uuid: string,
  file: UploadPart,
) {
  const current = await findAddonByUuid(client, uuid)
  if (!current) {
    throw new AppError('Add-on not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const image = await compressImageForStorage(file, {
    label: 'add-on image',
    maxEdge: 1280,
  })
  const storagePath = `${uuid}/${crypto.randomUUID()}.${image.extension}`
  const { error } = await client.storage.from(ADDON_IMAGE_BUCKET).upload(storagePath, image.data, {
    contentType: image.type,
    upsert: false,
  })
  if (error) {
    throw new AppError('We could not upload that add-on image.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  let row
  try {
    row = await updateAddonImagePath(client, uuid, storagePath)
  }
  catch (caught) {
    await client.storage.from(ADDON_IMAGE_BUCKET).remove([storagePath])
    throw caught
  }

  const previousPath = current.image_storage_path || null
  if (previousPath) {
    await client.storage.from(ADDON_IMAGE_BUCKET).remove([previousPath])
  }

  await recordAudit(event, client, {
    action: 'addon.image.upload',
    entity: 'addons',
    entityId: uuid,
    previous: { storagePath: previousPath },
    next: { storagePath },
  })

  return asPublic(row)
}

export async function removeAddonImage(event: H3Event, client: Client, uuid: string) {
  const current = await findAddonByUuid(client, uuid)
  if (!current) {
    throw new AppError('Add-on not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const previousPath = current.image_storage_path || null
  const row = await updateAddonImagePath(client, uuid, null)
  if (previousPath) {
    await client.storage.from(ADDON_IMAGE_BUCKET).remove([previousPath])
  }

  await recordAudit(event, client, {
    action: 'addon.image.delete',
    entity: 'addons',
    entityId: uuid,
    previous: { storagePath: previousPath },
  })

  return asPublic(row)
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
  return rows.map(row => toPublicAddonOffer(row, supabaseUrl()))
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
  options: { exceptRentalId?: number, retainUuids?: string[] } = {},
): Promise<{ lines: RentalAddonQuoteLine[], total: number }> {
  if (!selections.length) {
    return { lines: [], total: 0 }
  }

  const retain = new Set(options.retainUuids ?? [])
  const linked = await listLinkedAddonsForProduct(client, productId, {
    bookableOnly: false,
    exceptRentalId: options.exceptRentalId,
  })
  if (linked === null) {
    throw new AppError(ADDON_SETUP_FROM_REPO(), 409, ERROR_CODES.CONFLICT)
  }

  const linkedUuids = new Set(linked.map(row => row.uuid))
  const byUuid = new Map(linked.map(row => [row.uuid, row]))

  const retainedMissing = selections
    .map(selection => selection.uuid)
    .filter(uuid => retain.has(uuid) && !byUuid.has(uuid))
  if (retainedMissing.length) {
    const rows = await findAddonsByUuids(client, retainedMissing, {
      exceptRentalId: options.exceptRentalId,
    })
    for (const row of rows) {
      byUuid.set(row.uuid, row)
    }
  }

  const seen = new Set<string>()
  const lines: RentalAddonQuoteLine[] = []

  for (const selection of selections) {
    if (seen.has(selection.uuid)) {
      throw new AppError('Each add-on can only be selected once.', 400, ERROR_CODES.VALIDATION_ERROR)
    }
    seen.add(selection.uuid)

    const addon = byUuid.get(selection.uuid)
    const kept = retain.has(selection.uuid)
    if (!addon || addon.status !== 'active') {
      throw new AppError('That add-on is not available on this kit.', 409, ERROR_CODES.CONFLICT)
    }
    if (!kept && (!linkedUuids.has(addon.uuid) || !addon.bookable)) {
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

export async function replaceRentalAddonLines(
  client: Client,
  rentalId: number,
  lines: RentalAddonQuoteLine[],
) {
  await deleteRentalAddonItemsByRentalId(client, rentalId)
  await persistRentalAddonLines(client, rentalId, lines)
}

export async function retainedAddonUuidsForRental(client: Client, rentalId: number): Promise<string[]> {
  const items = await listRentalAddonItems(client, rentalId)
  return items.map((item) => {
    const addon = Array.isArray(item.addons) ? item.addons[0] : item.addons
    return addon?.uuid
  }).filter((uuid): uuid is string => Boolean(uuid))
}

export async function listActiveAddonsForAdminSelect(client: Client): Promise<PublicAddon[]> {
  const rows = await listAddons(client, { includeArchived: false })
  return (rows ?? []).map(asPublic)
}
