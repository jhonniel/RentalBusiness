<script setup lang="ts">
import type { PublicCategory, ProductListResponse } from '~/types/catalog'
import { PRODUCT_STATUSES } from '~/utils/constants'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Products',
  path: '/admin/products',
})

const searchInput = ref('')
const search = refDebounced(searchInput, 300)
const status = ref('')
const categoryUuid = ref('')
const page = ref(1)

const toast = useToast()
const deleteUuid = ref('')
const deletePending = ref(false)

const query = computed(() => ({
  search: search.value || undefined,
  status: status.value || undefined,
  categoryUuid: categoryUuid.value || undefined,
  page: page.value,
  pageSize: 20,
}))

const { data, error, pending, refresh } = await useFetch<ProductListResponse>('/api/admin/products', {
  query,
  watch: [query],
})

const { data: categories } = await useFetch<PublicCategory[]>('/api/admin/categories')

const unavailable = computed(() => error.value?.statusCode === 503)
const { formatMoney: money } = useCurrency()

watch([search, status, categoryUuid], () => {
  page.value = 1
})

const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / 20)))

async function deleteProduct(uuid: string) {
  deletePending.value = true
  try {
    await $fetch(`/api/admin/products/${uuid}`, { method: 'DELETE' })
    toast.add({ title: 'Product deleted', color: 'success' })
    deleteUuid.value = ''
    await refresh()
  }
  catch (caught) {
    const payload = typeof caught === 'object' && caught && 'data' in caught
      ? (caught as { data?: { message?: string } }).data
      : null
    toast.add({
      title: payload?.message || 'We could not delete that product.',
      color: 'error',
    })
  }
  finally {
    deletePending.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
          Catalog
        </p>
        <h2 class="mt-2 text-2xl font-medium text-stone-900">
          Products
        </h2>
        <p class="mt-1 text-sm text-stone-600">
          Pricing, inventory, images, and serialized assets.
        </p>
      </div>
      <div class="flex flex-wrap gap-2">
        <UButton
          to="/admin/categories"
          color="neutral"
          variant="outline"
        >
          Categories
        </UButton>
        <UButton to="/admin/products/new">
          Add product
        </UButton>
      </div>
    </div>

    <form
      class="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-3"
      method="get"
      @submit.prevent
    >
      <input
        v-model="searchInput"
        type="search"
        placeholder="Search name or SKU"
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
          v-for="item in PRODUCT_STATUSES"
          :key="item"
          :value="item"
        >
          {{ item }}
        </option>
      </select>
      <select
        v-model="categoryUuid"
        class="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
      >
        <option value="">
          All categories
        </option>
        <option
          v-for="category in categories"
          :key="category.uuid"
          :value="category.uuid"
        >
          {{ category.name }}
        </option>
      </select>
    </form>

    <AdminNotice
      v-if="unavailable"
      title="Catalog is not connected"
      description="Add live Supabase credentials and apply the Phase 2 migrations to manage products."
    />

    <div
      v-else-if="pending && !data"
      class="grid gap-3"
    >
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-24 w-full" />
    </div>

    <AdminNotice
      v-else-if="!data?.items.length"
      title="No products yet"
      description="Create a product to set pricing, deposits, and inventory."
    >
      <UButton to="/admin/products/new">
        Add product
      </UButton>
    </AdminNotice>

    <div
      v-else
      class="space-y-3"
    >
      <div class="hidden overflow-x-auto rounded-xl border border-stone-200 bg-white md:block">
        <table class="min-w-full text-left text-sm">
          <thead class="border-b border-stone-200 text-xs uppercase tracking-wider text-stone-500">
            <tr>
              <th class="px-4 py-3 font-medium">
                Product
              </th>
              <th class="px-4 py-3 font-medium">
                SKU
              </th>
              <th class="px-4 py-3 font-medium">
                Price
              </th>
              <th class="px-4 py-3 font-medium">
                Stock
              </th>
              <th class="px-4 py-3 font-medium">
                Status
              </th>
              <th class="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            <tr
              v-for="product in data.items"
              :key="product.uuid"
              class="border-b border-stone-100 last:border-0"
            >
              <td class="px-4 py-3">
                <p class="font-medium text-stone-900">
                  {{ product.name }}
                </p>
                <p class="text-xs text-stone-500">
                  {{ product.category.name }}
                </p>
              </td>
              <td class="px-4 py-3 text-stone-600">
                {{ product.sku }}
              </td>
              <td class="px-4 py-3 text-stone-600">
                {{ money(product.dailyPrice) }}/day
              </td>
              <td class="px-4 py-3 text-stone-600">
                {{ product.availableQuantity }} / {{ product.quantity }}
              </td>
              <td class="px-4 py-3">
                <StatusBadge :status="product.status" />
              </td>
              <td class="px-4 py-3 text-right">
                <div class="flex flex-wrap items-center justify-end gap-2">
                  <UButton
                    :to="`/admin/products/${product.uuid}`"
                    color="neutral"
                    variant="ghost"
                    size="sm"
                  >
                    Edit
                  </UButton>
                  <template v-if="deleteUuid === product.uuid">
                    <UButton
                      color="error"
                      size="sm"
                      :loading="deletePending"
                      @click="deleteProduct(product.uuid)"
                    >
                      Confirm
                    </UButton>
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      :disabled="deletePending"
                      @click="deleteUuid = ''"
                    >
                      Cancel
                    </UButton>
                  </template>
                  <UButton
                    v-else
                    color="error"
                    variant="ghost"
                    size="sm"
                    @click="deleteUuid = product.uuid"
                  >
                    Delete
                  </UButton>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <article
        v-for="product in data.items"
        :key="`card-${product.uuid}`"
        class="rounded-xl border border-stone-200 bg-white p-4 md:hidden"
      >
        <div class="flex flex-wrap items-center gap-2">
          <h3 class="font-medium text-stone-900">
            {{ product.name }}
          </h3>
          <StatusBadge :status="product.status" />
        </div>
        <p class="mt-1 text-sm text-stone-500">
          {{ product.category.name }} · {{ product.sku }} · {{ money(product.dailyPrice) }}/day
        </p>
        <p class="mt-1 text-sm text-stone-500">
          {{ product.availableQuantity }} of {{ product.quantity }} available
        </p>
        <div class="mt-3 flex flex-wrap gap-2">
          <UButton
            :to="`/admin/products/${product.uuid}`"
            color="neutral"
            variant="outline"
          >
            Edit
          </UButton>
          <template v-if="deleteUuid === product.uuid">
            <UButton
              color="error"
              :loading="deletePending"
              @click="deleteProduct(product.uuid)"
            >
              Confirm delete
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              :disabled="deletePending"
              @click="deleteUuid = ''"
            >
              Cancel
            </UButton>
          </template>
          <UButton
            v-else
            color="error"
            variant="outline"
            @click="deleteUuid = product.uuid"
          >
            Delete
          </UButton>
        </div>
      </article>

      <div
        v-if="totalPages > 1"
        class="flex flex-wrap items-center justify-between gap-2 text-sm text-stone-600"
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
