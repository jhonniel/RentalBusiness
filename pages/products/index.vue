<script setup lang="ts">
import type { CatalogListResponse, PublicCategory } from '~/types/catalog'
import { collectionJsonLd } from '~/utils/seo'

useSiteMeta({
  title: 'Equipment',
  description: 'Browse cameras, drones, Starlink, and production equipment for rent in Davao City.',
  path: '/products',
})

const route = useRoute()
const router = useRouter()
const searchInput = ref(typeof route.query.search === 'string' ? route.query.search : '')
const search = refDebounced(searchInput, 300)
const categorySlug = ref(typeof route.query.category === 'string' ? route.query.category : '')
const page = ref(Number(route.query.page) > 0 ? Number(route.query.page) : 1)

const query = computed(() => ({
  search: search.value || undefined,
  categorySlug: categorySlug.value || undefined,
  page: page.value,
  pageSize: 12,
}))

const { data, error, pending } = await useFetch<CatalogListResponse>('/api/products', {
  query,
  watch: [query],
})
const { data: categories } = await useFetch<PublicCategory[]>('/api/categories')

const config = useRuntimeConfig()
const origin = String(config.public.siteUrl || 'http://localhost:3000')
useHead(() => ({
  script: data.value?.items.length
    ? [{
        type: 'application/ld+json',
        innerHTML: JSON.stringify(collectionJsonLd(origin, data.value.items)),
      }]
    : [],
}))

const hasData = computed(() => Boolean(data.value))
const remote = useRemoteState(error, pending, hasData)
const notFoundCategory = computed(() => error.value?.statusCode === 404)
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / 12)))

watch([search, categorySlug], () => {
  page.value = 1
})

watch([search, categorySlug, page], () => {
  const nextQuery: Record<string, string> = {}
  if (search.value) {
    nextQuery.search = search.value
  }
  if (categorySlug.value) {
    nextQuery.category = categorySlug.value
  }
  if (page.value > 1) {
    nextQuery.page = String(page.value)
  }
  router.replace({ query: nextQuery })
})
</script>

<template>
  <section class="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
    <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#5b6b64]">
      Rent
    </p>
    <h1 class="mt-3 text-3xl font-semibold tracking-tight text-[#12201a] sm:text-4xl">
      Equipment
    </h1>
    <p class="mt-3 max-w-2xl text-sm text-[#5b6b64]">
      Search cameras, drones, Starlink kits, and production accessories. Prices are in Philippine pesos.
    </p>

    <form
      class="storefront-card mt-8 grid gap-3 rounded-3xl p-4 sm:grid-cols-[1fr_16rem]"
      method="get"
      @submit.prevent
    >
      <label class="block text-sm">
        <span class="mb-1 block text-xs font-medium text-stone-600">Search</span>
        <input
          v-model="searchInput"
          type="search"
          placeholder="Search name or SKU"
          class="w-full rounded-md border border-stone-200 px-3 py-2 text-sm"
        >
      </label>
      <label class="block text-sm">
        <span class="mb-1 block text-xs font-medium text-stone-600">Category</span>
        <select
          v-model="categorySlug"
          class="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">
            All categories
          </option>
          <option
            v-for="category in categories"
            :key="category.uuid"
            :value="category.slug"
          >
            {{ category.name }}
          </option>
        </select>
      </label>
    </form>

    <div class="mt-10">
      <CatalogNotice
        v-if="remote.unavailable"
        title="Catalog is not connected"
        description="Add live Supabase credentials and apply the catalog migrations to show rental equipment."
      />

      <CatalogNotice
        v-else-if="notFoundCategory"
        title="Category not found"
        description="That filter does not match an active category."
      >
        <UButton
          color="neutral"
          variant="outline"
          @click="categorySlug = ''"
        >
          Clear filter
        </UButton>
      </CatalogNotice>

      <CatalogNotice
        v-else-if="remote.failed"
        tone="alert"
        title="Catalog could not load"
        description="Try another search or refresh the page. Equipment listings will appear when the request succeeds."
      />

      <div
        v-else-if="remote.loading"
        class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        role="status"
        aria-busy="true"
      >
        <USkeleton
          v-for="index in 6"
          :key="index"
          class="h-72 w-full"
        />
      </div>

      <CatalogNotice
        v-else-if="!data?.items.length"
        title="No equipment matches"
        description="Try another search or category. New kits appear here when they are marked active."
      />

      <div
        v-else
        class="space-y-8"
      >
        <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <ProductCard
            v-for="product in data.items"
            :key="product.uuid"
            :product="product"
          />
        </div>
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
  </section>
</template>
