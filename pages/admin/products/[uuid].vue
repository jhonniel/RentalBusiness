<script setup lang="ts">
import type { InventoryListResponse, PublicCategory, PublicProduct } from '~/types/catalog'
import { EQUIPMENT_STATUSES } from '~/utils/constants'
import { equipmentInputSchema } from '~/utils/product-validation'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const uuid = computed(() => String(route.params.uuid))
const toast = useToast()

useSiteMeta({
  title: 'Edit product',
  path: `/admin/products/${uuid.value}`,
})

const { data: product, error, refresh } = await useFetch<PublicProduct>(
  () => `/api/admin/products/${uuid.value}`,
)
const { data: categories } = await useFetch<PublicCategory[]>('/api/admin/categories')
const { data: inventory, refresh: refreshAssets } = await useFetch<InventoryListResponse>(
  '/api/admin/inventory',
  { query: computed(() => ({ productUuid: uuid.value, pageSize: 50 })) },
)

const unavailable = computed(() => error.value?.statusCode === 503)
const missing = computed(() => error.value?.statusCode === 404)

const imageAlt = ref('')
const imageFiles = ref<File[]>([])
const imageInput = ref<HTMLInputElement | null>(null)
const imagePending = ref(false)
const imageError = ref('')
const archiveOpen = ref(false)
const archivePending = ref(false)
const deleteOpen = ref(false)
const deletePending = ref(false)

const assetForm = reactive({
  assetCode: '',
  serialNumber: '',
  condition: 'good',
  status: 'available' as typeof EQUIPMENT_STATUSES[number],
  notes: '',
})
const assetPending = ref(false)
const assetError = ref('')
const editingAsset = ref<string | null>(null)

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  imageFiles.value = input.files ? [...input.files] : []
}

async function uploadImage() {
  imageError.value = ''
  if (!imageFiles.value.length) {
    imageError.value = 'Choose one or more JPG, PNG, or WebP images.'
    return
  }

  const body = new FormData()
  for (const file of imageFiles.value) {
    body.append('file', file)
  }
  body.append('alt', imageAlt.value)

  imagePending.value = true
  try {
    await $fetch(`/api/admin/products/${uuid.value}/images`, {
      method: 'POST',
      body,
    })
    const count = imageFiles.value.length
    imageFiles.value = []
    imageAlt.value = ''
    if (imageInput.value) {
      imageInput.value.value = ''
    }
    toast.add({
      title: count === 1 ? 'Image uploaded' : `${count} images uploaded`,
      color: 'success',
    })
    await refresh()
  }
  catch (error) {
    imageError.value = apiErrorMessage(error, 'We could not upload those images.')
  }
  finally {
    imagePending.value = false
  }
}

async function removeImage(imageUuid: string) {
  try {
    await $fetch(`/api/admin/images/${imageUuid}`, { method: 'DELETE' })
    toast.add({ title: 'Image removed', color: 'success' })
    await refresh()
  }
  catch (error) {
    imageError.value = apiErrorMessage(error, 'We could not remove that image.')
  }
}

function startAssetEdit(assetUuid: string) {
  const asset = inventory.value?.items.find(item => item.uuid === assetUuid)
  if (!asset) {
    return
  }

  editingAsset.value = asset.uuid
  assetForm.assetCode = asset.assetCode
  assetForm.serialNumber = asset.serialNumber ?? ''
  assetForm.condition = asset.condition
  assetForm.status = asset.status
  assetForm.notes = asset.notes ?? ''
}

function resetAssetForm() {
  editingAsset.value = null
  assetForm.assetCode = ''
  assetForm.serialNumber = ''
  assetForm.condition = 'good'
  assetForm.status = 'available'
  assetForm.notes = ''
}

async function saveAsset() {
  assetError.value = ''
  const parsed = equipmentInputSchema.safeParse(assetForm)
  if (!parsed.success) {
    assetError.value = parsed.error.issues[0]?.message || 'Check the asset details.'
    return
  }

  assetPending.value = true
  try {
    if (editingAsset.value) {
      await $fetch(`/api/admin/assets/${editingAsset.value}`, {
        method: 'PATCH',
        body: parsed.data,
      })
    }
    else {
      await $fetch(`/api/admin/products/${uuid.value}/assets`, {
        method: 'POST',
        body: parsed.data,
      })
    }
    toast.add({ title: 'Asset saved', color: 'success' })
    resetAssetForm()
    await refreshAssets()
  }
  catch (error) {
    assetError.value = apiErrorMessage(error, 'We could not save that asset.')
  }
  finally {
    assetPending.value = false
  }
}

async function archiveProduct() {
  archivePending.value = true
  try {
    await $fetch(`/api/admin/products/${uuid.value}/archive`, { method: 'POST' })
    toast.add({ title: 'Product archived', color: 'success' })
    archiveOpen.value = false
    await refresh()
  }
  catch (error) {
    toast.add({
      title: apiErrorMessage(error, 'We could not archive that product.'),
      color: 'error',
    })
  }
  finally {
    archivePending.value = false
  }
}

async function deleteProduct() {
  deletePending.value = true
  try {
    await $fetch(`/api/admin/products/${uuid.value}`, { method: 'DELETE' })
    toast.add({ title: 'Product deleted', color: 'success' })
    await navigateTo('/admin/products')
  }
  catch (error) {
    toast.add({
      title: apiErrorMessage(error, 'We could not delete that product.'),
      color: 'error',
    })
  }
  finally {
    deletePending.value = false
  }
}

function apiErrorMessage(error: unknown, fallback: string) {
  const payload = typeof error === 'object' && error && 'data' in error
    ? (error as { data?: { message?: string } }).data
    : null
  return payload?.message || fallback
}

async function onSaved() {
  await refresh()
}
</script>

<template>
  <div class="mx-auto max-w-4xl space-y-8">
    <div>
      <UButton
        to="/admin/products"
        color="neutral"
        variant="ghost"
        class="-ml-2"
      >
        Back to products
      </UButton>
      <h2 class="mt-3 text-2xl font-medium text-stone-900">
        {{ product?.name || 'Edit product' }}
      </h2>
      <p class="mt-1 text-sm text-stone-600">
        Update the name, prices, About this kit copy, specifications, accessories, rental rules, images, and serialized equipment.
      </p>
    </div>

    <AdminNotice
      v-if="unavailable"
      title="Catalog is not connected"
      description="Add live Supabase credentials and apply the Phase 2 migrations to edit products."
    />

    <AdminNotice
      v-else-if="missing"
      title="Product not found"
      description="That product uuid is not in the catalog."
    >
      <UButton to="/admin/products">
        View products
      </UButton>
    </AdminNotice>

    <template v-else-if="product && categories">
      <ProductEditor
        :product="product"
        :categories="categories"
        @saved="onSaved"
      />

      <section class="rounded-xl border border-stone-200 bg-white p-5">
        <h3 class="text-sm font-medium text-stone-900">
          Images
        </h3>
        <p class="mt-1 text-sm text-stone-500">
          Add several photos. Customers see extra shots under the main image on the product page. JPG, PNG, or WebP up to 5 MB, stored on Supabase Storage.
        </p>

        <AuthAlert
          v-if="imageError"
          class="mt-4"
          :description="imageError"
        />

        <form
          class="mt-4 grid gap-3 sm:grid-cols-2 sm:items-end lg:grid-cols-[1fr_1fr_auto]"
          method="post"
          @submit.prevent="uploadImage"
        >
          <label class="block text-sm">
            <span class="mb-1.5 block text-stone-700">File</span>
            <input
              ref="imageInput"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              :disabled="imagePending"
              class="block w-full text-sm"
              @change="onFileChange"
            >
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block text-stone-700">Alt text</span>
            <UInput
              v-model="imageAlt"
              :disabled="imagePending"
            />
          </label>
          <UButton
            type="submit"
            :loading="imagePending"
          >
            Upload
          </UButton>
        </form>

        <div
          v-if="product.images.length"
          class="mt-4 grid gap-3 sm:grid-cols-3"
        >
          <figure
            v-for="image in product.images"
            :key="image.uuid"
            class="overflow-hidden rounded-lg border border-stone-200"
          >
            <img
              :src="image.url"
              :alt="image.alt"
              class="h-36 w-full object-cover"
            >
            <figcaption class="flex items-center justify-between gap-2 px-3 py-2 text-xs text-stone-600">
              <span class="truncate">{{ image.alt || 'Untitled' }}</span>
              <UButton
                color="error"
                variant="ghost"
                size="xs"
                @click="removeImage(image.uuid)"
              >
                Remove
              </UButton>
            </figcaption>
          </figure>
        </div>
      </section>

      <section class="rounded-xl border border-stone-200 bg-white p-5">
        <h3 class="text-sm font-medium text-stone-900">
          Equipment assets
        </h3>
        <p class="mt-1 text-sm text-stone-500">
          Serialized units for this product. Asset codes are public identifiers.
        </p>

        <AuthAlert
          v-if="assetError"
          class="mt-4"
          :description="assetError"
        />

        <form
          class="mt-4 grid gap-3 sm:grid-cols-2"
          method="post"
          @submit.prevent="saveAsset"
        >
          <label class="block text-sm">
            <span class="mb-1.5 block text-stone-700">Asset code</span>
            <UInput
              v-model="assetForm.assetCode"
              :disabled="assetPending"
            />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block text-stone-700">Serial number</span>
            <UInput
              v-model="assetForm.serialNumber"
              :disabled="assetPending"
            />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block text-stone-700">Condition</span>
            <UInput
              v-model="assetForm.condition"
              :disabled="assetPending"
            />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block text-stone-700">Status</span>
            <select
              v-model="assetForm.status"
              class="w-full rounded-md border border-stone-200 bg-white px-3 py-2"
              :disabled="assetPending"
            >
              <option
                v-for="item in EQUIPMENT_STATUSES"
                :key="item"
                :value="item"
              >
                {{ item }}
              </option>
            </select>
          </label>
          <label class="block text-sm sm:col-span-2">
            <span class="mb-1.5 block text-stone-700">Notes</span>
            <UInput
              v-model="assetForm.notes"
              :disabled="assetPending"
            />
          </label>
          <div class="flex flex-wrap gap-2">
            <UButton
              type="submit"
              :loading="assetPending"
            >
              {{ editingAsset ? 'Update asset' : 'Add asset' }}
            </UButton>
            <UButton
              v-if="editingAsset"
              type="button"
              color="neutral"
              variant="ghost"
              @click="resetAssetForm"
            >
              Cancel
            </UButton>
          </div>
        </form>

        <ul
          v-if="inventory?.items.length"
          class="mt-4 divide-y divide-stone-100 rounded-lg border border-stone-200"
        >
          <li
            v-for="asset in inventory.items"
            :key="asset.uuid"
            class="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
          >
            <div>
              <p class="font-medium text-stone-900">
                {{ asset.assetCode }}
              </p>
              <p class="text-stone-500">
                {{ asset.serialNumber || 'No serial' }} · {{ asset.condition }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <StatusBadge :status="asset.status" />
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                @click="startAssetEdit(asset.uuid)"
              >
                Edit
              </UButton>
            </div>
          </li>
        </ul>
      </section>

      <section
        v-if="product.status !== 'archived'"
        class="rounded-xl border border-red-200 bg-red-50 p-5"
      >
        <h3 class="text-sm font-medium text-red-900">
          Archive
        </h3>
        <p class="mt-1 text-sm text-red-800">
          Archived products stay in the database. They are hidden from the public catalog later.
        </p>
        <UButton
          v-if="!archiveOpen"
          class="mt-4"
          color="error"
          variant="outline"
          @click="archiveOpen = true"
        >
          Archive product
        </UButton>
        <div
          v-else
          class="mt-4 flex flex-wrap items-center gap-2"
        >
          <p class="text-sm text-red-800">
            Archive {{ product.name }}?
          </p>
          <UButton
            color="error"
            :loading="archivePending"
            @click="archiveProduct"
          >
            Confirm archive
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            :disabled="archivePending"
            @click="archiveOpen = false"
          >
            Cancel
          </UButton>
        </div>
      </section>

      <section class="rounded-xl border border-red-200 bg-red-50 p-5">
        <h3 class="text-sm font-medium text-red-900">
          Delete
        </h3>
        <p class="mt-1 text-sm text-red-800">
          Permanently removes this product, its photos, and unused inventory units. Products on rental history cannot be deleted — archive them instead.
        </p>
        <UButton
          v-if="!deleteOpen"
          class="mt-4"
          color="error"
          @click="deleteOpen = true"
        >
          Delete product
        </UButton>
        <div
          v-else
          class="mt-4 flex flex-wrap items-center gap-2"
        >
          <p class="text-sm text-red-800">
            Delete {{ product.name }} forever?
          </p>
          <UButton
            color="error"
            :loading="deletePending"
            @click="deleteProduct"
          >
            Confirm delete
          </UButton>
          <UButton
            color="neutral"
            variant="ghost"
            :disabled="deletePending"
            @click="deleteOpen = false"
          >
            Cancel
          </UButton>
        </div>
      </section>
    </template>
  </div>
</template>
