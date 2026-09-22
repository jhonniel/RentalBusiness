import type { H3Event } from 'h3'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database, Json } from '../../types/database.types'
import type { CategoryInput, EquipmentInput, ProductInput } from '../../utils/product-validation'
import { PUBLIC_CATALOG_PRODUCT_STATUSES, isPublicCatalogProductStatus } from '../../utils/constants'
import { toHiddenPriceFieldDb } from '../../utils/price-visibility'
import { canDeleteProduct, toCatalogProduct, toPublicAsset, toPublicCategory, toPublicImage, toPublicProduct } from '../../utils/catalog'
import { isUuid, normalizeSku, slugify } from '../../utils/slug'
import { AppError, ERROR_CODES } from '../utils/errors'
import { recordAudit } from '../utils/audit'
import {
  createCategory,
  listCategories,
  updateCategory,
} from '../repositories/category.repository'
import {
  countAssetAssignments,
  countRentalItemsForProduct,
  deleteAssetsByProductId,
  deleteImageByUuid,
  deleteProductByUuid,
  findCategoryIdBySlug,
  findCategoryIdByUuid,
  findImageByUuid,
  findProductBySlug,
  findProductByUuid,
  findProductIdByUuid,
  listAssetIdsForProduct,
  listImagesByProductIds,
  insertProduct,
  insertProductImage,
  listProductImages,
  listProducts,
  updateProductByUuid,
} from '../repositories/product.repository'
import { insertAsset, listAssets, updateAssetByUuid } from '../repositories/equipment.repository'

type Client = SupabaseClient<Database>

function supabaseUrl() {
  const config = useRuntimeConfig()
  return config.public.supabaseUrl || process.env.NUXT_PUBLIC_SUPABASE_URL || ''
}

function sanitizeSearch(value?: string) {
  return value?.replace(/[%_,]/g, '').trim() || undefined
}

function uniqueSlug(base: string, existing: string[]) {
  const root = slugify(base) || 'item'
  if (!existing.includes(root)) {
    return root
  }

  let index = 2
  while (existing.includes(`${root}-${index}`)) {
    index += 1
  }
  return `${root}-${index}`
}

function uniqueSku(base: string, existing: string[]) {
  const root = normalizeSku(base) || 'ITEM'
  if (!existing.includes(root)) {
    return root
  }

  let index = 2
  while (existing.includes(`${root}-${index}`)) {
    index += 1
  }
  return `${root}-${index}`
}

export async function getAdminCategories(client: Client) {
  const rows = await listCategories(client)
  return rows.map(toPublicCategory)
}

export async function saveCategory(event: H3Event, client: Client, input: CategoryInput, uuid?: string) {
  const rows = await listCategories(client)
  const slug = uniqueSlug(input.slug || input.name, rows.filter(row => row.uuid !== uuid).map(row => row.slug))
  const payload = {
    name: input.name,
    slug,
    description: input.description || null,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
  }

  const row = uuid
    ? await updateCategory(client, uuid, payload)
    : await createCategory(client, payload)

  await recordAudit(event, client, {
    action: uuid ? 'category.update' : 'category.create',
    entity: 'product_categories',
    entityId: row.uuid,
    next: toPublicCategory(row) as unknown as Json,
  })

  return toPublicCategory(row)
}

export async function getAdminProducts(client: Client, query: {
  search?: string
  status?: ProductInput['status']
  categoryUuid?: string
  page: number
  pageSize: number
}) {
  let categoryId: number | undefined
  if (query.categoryUuid) {
    const category = await findCategoryIdByUuid(client, query.categoryUuid)
    if (!category) {
      throw new AppError('Category not found.', 404, ERROR_CODES.NOT_FOUND)
    }
    categoryId = category.id
  }

  const from = (query.page - 1) * query.pageSize
  const { rows, total } = await listProducts(client, {
    search: sanitizeSearch(query.search),
    status: query.status,
    categoryId,
    from,
    to: from + query.pageSize - 1,
  })

  const items = await Promise.all(rows.map(async (row) => {
    const product = await findProductIdByUuid(client, row.uuid)
    const images = product ? await listProductImages(client, product.id) : []
    return toPublicProduct(row, images, supabaseUrl())
  }))

  return {
    items,
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function getAdminProduct(client: Client, uuid: string) {
  const row = await findProductByUuid(client, uuid)
  if (!row) {
    throw new AppError('Product not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const identity = await findProductIdByUuid(client, uuid)
  const images = identity ? await listProductImages(client, identity.id) : []
  return toPublicProduct(row, images, supabaseUrl())
}

function toProductWrite(input: ProductInput, categoryId: number, slug: string, sku: string) {
  return {
    name: input.name,
    slug,
    sku,
    category_id: categoryId,
    description: input.description,
    short_description: input.shortDescription,
    daily_price: input.dailyPrice,
    weekly_price: input.weeklyPrice,
    monthly_price: input.monthlyPrice,
    deposit_amount: input.depositAmount,
    late_fee: input.lateFee,
    replacement_value: input.replacementValue,
    hidden_price_fields: toHiddenPriceFieldDb(input.hiddenPriceFields),
    quantity: input.quantity,
    reserved_quantity: input.reservedQuantity,
    rented_quantity: input.rentedQuantity,
    damaged_quantity: input.damagedQuantity,
    maintenance_quantity: input.maintenanceQuantity,
    lost_quantity: input.lostQuantity,
    status: input.status,
    condition: input.condition,
    specifications: input.specifications,
    included_accessories: input.includedAccessories,
    rental_rules: input.rentalRules || null,
    model_path: input.modelPath || null,
    is_featured: input.isFeatured,
  }
}

export async function saveProduct(event: H3Event, client: Client, input: ProductInput, uuid?: string) {
  const category = await findCategoryIdByUuid(client, input.categoryUuid)
  if (!category) {
    throw new AppError('Category not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const existing = await listProducts(client, { from: 0, to: 499 })
  const others = existing.rows.filter(row => row.uuid !== uuid)
  const previous = uuid ? await findProductByUuid(client, uuid) : null
  const slug = uniqueSlug(input.name, others.map(row => row.slug))
  const sku = previous?.sku || uniqueSku(input.name, others.map(row => row.sku))
  const values = toProductWrite(input, category.id, slug, sku)
  const row = uuid
    ? await updateProductByUuid(client, uuid, values)
    : await insertProduct(client, values)

  const identity = await findProductIdByUuid(client, row.uuid)
  const images = identity ? await listProductImages(client, identity.id) : []
  const product = toPublicProduct(row, images, supabaseUrl())

  await recordAudit(event, client, {
    action: uuid ? 'product.update' : 'product.create',
    entity: 'products',
    entityId: row.uuid,
    previous: previous ? { uuid: previous.uuid, status: previous.status, daily_price: previous.daily_price } : null,
    next: { uuid: product.uuid, status: product.status, dailyPrice: product.dailyPrice },
  })

  return product
}

export async function archiveProduct(event: H3Event, client: Client, uuid: string) {
  const previous = await getAdminProduct(client, uuid)
  const row = await updateProductByUuid(client, uuid, { status: 'archived' })
  const identity = await findProductIdByUuid(client, uuid)
  const images = identity ? await listProductImages(client, identity.id) : []
  const product = toPublicProduct(row, images, supabaseUrl())

  await recordAudit(event, client, {
    action: 'product.archive',
    entity: 'products',
    entityId: uuid,
    previous: { status: previous.status },
    next: { status: 'archived' },
  })

  return product
}

export async function deleteProduct(event: H3Event, client: Client, uuid: string) {
  const identity = await findProductIdByUuid(client, uuid)
  if (!identity) {
    throw new AppError('Product not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const previous = await findProductByUuid(client, uuid)
  const assetIds = await listAssetIdsForProduct(client, identity.id)
  const [rentalItems, assignments] = await Promise.all([
    countRentalItemsForProduct(client, identity.id),
    countAssetAssignments(client, assetIds),
  ])

  if (!canDeleteProduct({ rentalItems, assignments })) {
    throw new AppError(
      'This product is on rental history and cannot be deleted. Archive it to hide it from the catalog.',
      409,
      ERROR_CODES.CONFLICT,
    )
  }

  const images = await listProductImages(client, identity.id)
  const paths = images.map(image => image.storage_path).filter(Boolean)
  if (paths.length) {
    await client.storage.from('product-images').remove(paths)
  }

  await deleteAssetsByProductId(client, identity.id)
  await deleteProductByUuid(client, uuid)

  await recordAudit(event, client, {
    action: 'product.delete',
    entity: 'products',
    entityId: uuid,
    previous: previous
      ? { uuid: previous.uuid, name: previous.name, sku: previous.sku, status: previous.status }
      : { uuid },
  })

  return { deleted: true, uuid }
}

export async function addProductImage(
  event: H3Event,
  client: Client,
  productUuid: string,
  file: { filename?: string, type?: string, data: Buffer },
  alt: string,
) {
  const product = await findProductIdByUuid(client, productUuid)
  if (!product) {
    throw new AppError('Product not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const allowed = ['image/jpeg', 'image/png', 'image/webp']
  if (!file.type || !allowed.includes(file.type)) {
    throw new AppError('Upload a JPG, PNG, or WebP image.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  if (file.data.byteLength > 5 * 1024 * 1024) {
    throw new AppError('Images must be 5 MB or smaller.', 422, ERROR_CODES.VALIDATION_ERROR)
  }

  const extension = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
  const storagePath = `${productUuid}/${crypto.randomUUID()}.${extension}`
  const { error } = await client.storage.from('product-images').upload(storagePath, file.data, {
    contentType: file.type,
    upsert: false,
  })

  if (error) {
    throw new AppError('We could not upload that image.', 400, ERROR_CODES.VALIDATION_ERROR, { cause: error })
  }

  const existing = await listProductImages(client, product.id)
  const row = await insertProductImage(client, {
    productId: product.id,
    storagePath,
    alt,
    sortOrder: existing.length,
  })

  await recordAudit(event, client, {
    action: 'product.image.create',
    entity: 'product_images',
    entityId: row.uuid,
    next: { productUuid, storagePath },
  })

  return toPublicImage(row, supabaseUrl())
}

export async function addProductImages(
  event: H3Event,
  client: Client,
  productUuid: string,
  files: { filename?: string, type?: string, data: Buffer }[],
  alt: string,
) {
  const uploaded = []
  for (const file of files) {
    uploaded.push(await addProductImage(event, client, productUuid, file, alt))
  }
  return uploaded
}

export async function removeProductImage(event: H3Event, client: Client, imageUuid: string) {
  const image = await findImageByUuid(client, imageUuid)
  if (!image) {
    throw new AppError('Image not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  await client.storage.from('product-images').remove([image.storage_path])
  await deleteImageByUuid(client, imageUuid)
  await recordAudit(event, client, {
    action: 'product.image.delete',
    entity: 'product_images',
    entityId: imageUuid,
    previous: { storagePath: image.storage_path },
  })
}

export async function getInventory(client: Client, query: {
  search?: string
  status?: EquipmentInput['status']
  productUuid?: string
  page: number
  pageSize: number
}) {
  let productId: number | undefined
  if (query.productUuid) {
    const product = await findProductIdByUuid(client, query.productUuid)
    if (!product) {
      throw new AppError('Product not found.', 404, ERROR_CODES.NOT_FOUND)
    }
    productId = product.id
  }

  const from = (query.page - 1) * query.pageSize
  const { rows, total } = await listAssets(client, {
    search: sanitizeSearch(query.search),
    status: query.status,
    productId,
    from,
    to: from + query.pageSize - 1,
  })

  return {
    items: rows.map(toPublicAsset),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function saveAsset(
  event: H3Event,
  client: Client,
  input: EquipmentInput,
  options: { productUuid?: string, assetUuid?: string },
) {
  const values = {
    asset_code: normalizeSku(input.assetCode),
    serial_number: input.serialNumber || null,
    condition: input.condition,
    status: input.status,
    purchase_cost: input.purchaseCost,
    purchase_date: input.purchaseDate || null,
    replacement_value: input.replacementValue,
    notes: input.notes || null,
  }

  let row
  if (options.assetUuid) {
    row = await updateAssetByUuid(client, options.assetUuid, values)
  }
  else {
    if (!options.productUuid) {
      throw new AppError('Product is required.', 422, ERROR_CODES.VALIDATION_ERROR)
    }
    const product = await findProductIdByUuid(client, options.productUuid)
    if (!product) {
      throw new AppError('Product not found.', 404, ERROR_CODES.NOT_FOUND)
    }
    row = await insertAsset(client, { ...values, product_id: product.id })
  }

  const asset = toPublicAsset(row)
  await recordAudit(event, client, {
    action: options.assetUuid ? 'equipment.update' : 'equipment.create',
    entity: 'equipment_assets',
    entityId: asset.uuid,
    next: { assetCode: asset.assetCode, status: asset.status },
  })

  return asset
}

export async function getPublicCategories(client: Client) {
  const rows = await listCategories(client)
  return rows.filter(row => row.is_active).map(toPublicCategory)
}

export async function getPublicProducts(client: Client, query: {
  search?: string
  categoryUuid?: string
  categorySlug?: string
  featured?: boolean
  page: number
  pageSize: number
}) {
  let categoryId: number | undefined

  if (query.categorySlug) {
    const category = await findCategoryIdBySlug(client, query.categorySlug)
    if (!category) {
      throw new AppError('Category not found.', 404, ERROR_CODES.NOT_FOUND)
    }
    categoryId = category.id
  }
  else if (query.categoryUuid) {
    const category = await findCategoryIdByUuid(client, query.categoryUuid)
    if (!category) {
      throw new AppError('Category not found.', 404, ERROR_CODES.NOT_FOUND)
    }
    categoryId = category.id
  }

  const from = (query.page - 1) * query.pageSize
  const { rows, total } = await listProducts(client, {
    search: sanitizeSearch(query.search),
    statuses: [...PUBLIC_CATALOG_PRODUCT_STATUSES],
    categoryId,
    featured: query.featured,
    from,
    to: from + query.pageSize - 1,
  })

  const images = await listImagesByProductIds(client, rows.flatMap(row => row.id ? [row.id] : []))
  const imagesByProduct = new Map<number, typeof images>()
  for (const image of images) {
    if (!image.product_id) {
      continue
    }
    const list = imagesByProduct.get(image.product_id) ?? []
    list.push(image)
    imagesByProduct.set(image.product_id, list)
  }

  return {
    items: rows.map(row => toCatalogProduct(row, row.id ? imagesByProduct.get(row.id) ?? [] : [], supabaseUrl())),
    page: query.page,
    pageSize: query.pageSize,
    total,
  }
}

export async function getPublicProduct(client: Client, identifier: string) {
  const row = isUuid(identifier)
    ? await findProductByUuid(client, identifier)
    : await findProductBySlug(client, identifier)

  if (!row || !isPublicCatalogProductStatus(row.status)) {
    throw new AppError('Product not found.', 404, ERROR_CODES.NOT_FOUND)
  }

  const images = row.id ? await listProductImages(client, row.id) : []
  return toCatalogProduct(row, images, supabaseUrl())
}
