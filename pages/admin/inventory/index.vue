<script setup lang="ts">
import type { InventoryListResponse, ProductListResponse } from '~/types/catalog'
import { EQUIPMENT_STATUSES } from '~/utils/constants'
import { equipmentInputSchema } from '~/utils/product-validation'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Inventory',
  path: '/admin/inventory',
})

const toast = useToast()
const searchInput = ref('')
const search = refDebounced(searchInput, 300)
const status = ref('')
const productUuid = ref('')
const page = ref(1)

const query = computed(() => ({
  search: search.value || undefined,
  status: status.value || undefined,
  productUuid: productUuid.value || undefined,
  page: page.value,
  pageSize: 20,
}))

const { data, error, pending, refresh } = await useFetch<InventoryListResponse>('/api/admin/inventory', {
  query,
  watch: [query],
})
const { data: products } = await useFetch<ProductListResponse>('/api/admin/products', {
  query: { pageSize: 50 },
})

const unavailable = computed(() => error.value?.statusCode === 503)
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / 20)))

watch([search, status, productUuid], () => {
  page.value = 1
})

const editingUuid = ref<string | null>(null)
const formError = ref('')
const saving = ref(false)
const form = reactive({
  assetCode: '',
  serialNumber: '',
  condition: 'good',
  status: 'available' as typeof EQUIPMENT_STATUSES[number],
  notes: '',
})

function startEdit(assetUuid: string) {
  const asset = data.value?.items.find(item => item.uuid === assetUuid)
  if (!asset) {
    return
  }

  editingUuid.value = asset.uuid
  form.assetCode = asset.assetCode
  form.serialNumber = asset.serialNumber ?? ''
  form.condition = asset.condition
  form.status = asset.status
  form.notes = asset.notes ?? ''
}

function cancelEdit() {
  editingUuid.value = null
}

async function saveAsset() {
  if (!editingUuid.value) {
    return
  }

  formError.value = ''
  const parsed = equipmentInputSchema.safeParse(form)
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message || 'Check the asset details.'
    return
  }

  saving.value = true
  try {
    await $fetch(`/api/admin/assets/${editingUuid.value}`, {
      method: 'PATCH',
      body: parsed.data,
    })
    toast.add({ title: 'Asset updated', color: 'success' })
    editingUuid.value = null
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not update that asset.'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <div>
      <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
        Catalog
      </p>
      <h2 class="mt-2 text-2xl font-medium text-stone-900">
        Inventory
      </h2>
      <p class="mt-1 text-sm text-stone-600">
        Serialized equipment assets. Add new units from a product page.
      </p>
    </div>

    <form
      class="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-3"
      method="get"
      @submit.prevent
    >
      <input
        v-model="searchInput"
        type="search"
        placeholder="Search asset code or serial"
        class="rounded-md border border-stone-200 px-3 py-2 text-sm"
      >
      <select
        v-model="status"
        class="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
      >
        <option value="">
          All statuses
        </option>
        <option
          v-for="item in EQUIPMENT_STATUSES"
          :key="item"
          :value="item"
        >
          {{ item }}
        </option>
      </select>
      <select
        v-model="productUuid"
        class="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
      >
        <option value="">
          All products
        </option>
        <option
          v-for="product in products?.items"
          :key="product.uuid"
          :value="product.uuid"
        >
          {{ product.name }}
        </option>
      </select>
    </form>

    <AdminNotice
      v-if="unavailable"
      title="Inventory is not connected"
      description="Add live Supabase credentials and apply the Phase 2 migrations to manage assets."
    />

    <div
      v-else-if="pending && !data"
      class="space-y-3"
    >
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-24 w-full" />
    </div>

    <AdminNotice
      v-else-if="!data?.items.length"
      title="No assets yet"
      description="Open a product and add serialized units there."
    >
      <UButton to="/admin/products">
        View products
      </UButton>
    </AdminNotice>

    <div
      v-else
      class="space-y-3"
    >
      <AuthAlert
        v-if="formError"
        :description="formError"
      />

      <div class="hidden overflow-x-auto rounded-xl border border-stone-200 bg-white md:block">
        <table class="min-w-full text-left text-sm">
          <thead class="border-b border-stone-200 text-xs uppercase tracking-wider text-stone-500">
            <tr>
              <th class="px-4 py-3 font-medium">
                Asset
              </th>
              <th class="px-4 py-3 font-medium">
                Product
              </th>
              <th class="px-4 py-3 font-medium">
                Condition
              </th>
              <th class="px-4 py-3 font-medium">
                Status
              </th>
              <th class="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="asset in data.items"
              :key="asset.uuid"
              class="border-b border-stone-100 last:border-0"
            >
              <td class="px-4 py-3">
                <p class="font-medium text-stone-900">
                  {{ asset.assetCode }}
                </p>
                <p class="text-xs text-stone-500">
                  {{ asset.serialNumber || 'No serial' }}
                </p>
              </td>
              <td class="px-4 py-3 text-stone-600">
                {{ asset.product.name }}
              </td>
              <td class="px-4 py-3 text-stone-600">
                {{ asset.condition }}
              </td>
              <td class="px-4 py-3">
                <StatusBadge :status="asset.status" />
              </td>
              <td class="px-4 py-3 text-right">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="sm"
                  @click="startEdit(asset.uuid)"
                >
                  Edit
                </UButton>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <article
        v-for="asset in data.items"
        :key="`card-${asset.uuid}`"
        class="rounded-xl border border-stone-200 bg-white p-4 md:hidden"
      >
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="font-medium text-stone-900">
            {{ asset.assetCode }}
          </h3>
          <StatusBadge :status="asset.status" />
        </div>
        <p class="mt-1 text-sm text-stone-500">
          {{ asset.product.name }} · {{ asset.serialNumber || 'No serial' }} · {{ asset.condition }}
        </p>
        <UButton
          color="neutral"
          variant="outline"
          class="mt-3"
          @click="startEdit(asset.uuid)"
        >
          Edit
        </UButton>
      </article>

      <form
        v-if="editingUuid"
        class="rounded-xl border border-stone-200 bg-white p-5"
        method="post"
        @submit.prevent="saveAsset"
      >
        <h3 class="text-sm font-medium text-stone-900">
          Edit asset
        </h3>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="mb-1.5 block text-stone-700">Asset code</span>
            <UInput
              v-model="form.assetCode"
              :disabled="saving"
            />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block text-stone-700">Serial number</span>
            <UInput
              v-model="form.serialNumber"
              :disabled="saving"
            />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block text-stone-700">Condition</span>
            <UInput
              v-model="form.condition"
              :disabled="saving"
            />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block text-stone-700">Status</span>
            <select
              v-model="form.status"
              class="w-full rounded-md border border-stone-200 bg-white px-3 py-2"
              :disabled="saving"
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
              v-model="form.notes"
              :disabled="saving"
            />
          </label>
        </div>
        <div class="mt-4 flex gap-2">
          <UButton
            type="submit"
            :loading="saving"
          >
            Save asset
          </UButton>
          <UButton
            type="button"
            color="neutral"
            variant="ghost"
            @click="cancelEdit"
          >
            Cancel
          </UButton>
        </div>
      </form>

      <div
        v-if="totalPages > 1"
        class="flex items-center justify-between text-sm text-stone-600"
      >
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="page === 1"
          @click="page -= 1"
        >
          Previous
        </UButton>
        <span>Page {{ page }} of {{ totalPages }}</span>
        <UButton
          color="neutral"
          variant="ghost"
          :disabled="page >= totalPages"
          @click="page += 1"
        >
          Next
        </UButton>
      </div>
    </div>
  </div>
</template>
