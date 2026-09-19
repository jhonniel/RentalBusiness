<script setup lang="ts">
import type { CatalogProduct } from '~/types/catalog'
import { visibleCatalogPrices } from '~/utils/price-visibility'
import { breadcrumbJsonLd, productJsonLd } from '~/utils/seo'

const route = useRoute()
const identifier = computed(() => String(route.params.id))
const { isAdmin } = useAuth()
const { formatMoney } = useCurrency()

const { data: product, error } = await useFetch<CatalogProduct>(
  () => `/api/products/${identifier.value}`,
)

if (error.value?.statusCode === 404) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Product not found',
  })
}

useSiteMeta({
  title: product.value?.name || 'Equipment',
  description: product.value?.shortDescription || product.value?.description,
  path: `/products/${product.value?.slug || identifier.value}`,
  image: product.value?.images[0]?.url,
  imageAlt: product.value?.images[0]?.alt || product.value?.name,
  ogType: 'product',
})

const config = useRuntimeConfig()
const origin = String(config.public.siteUrl || 'http://localhost:3000')
useHead({
  script: product.value
    ? [
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify(productJsonLd(origin, product.value)),
        },
        {
          type: 'application/ld+json',
          innerHTML: JSON.stringify(breadcrumbJsonLd(origin, [
            { name: 'Home', path: '/' },
            { name: 'Equipment', path: '/products' },
            { name: product.value.name, path: `/products/${product.value.slug}` },
          ])),
        },
      ]
    : [],
})

const specEntries = computed(() => Object.entries(product.value?.specifications ?? {}))
const priceRows = computed(() => product.value ? visibleCatalogPrices(product.value) : [])
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-16 lg:px-8">
    <CatalogNotice
      v-if="error?.statusCode === 503"
      title="Catalog is not connected"
      description="Add live Supabase credentials to load this product."
    >
      <UButton
        to="/products"
        color="neutral"
        variant="outline"
      >
        Back to equipment
      </UButton>
    </CatalogNotice>

    <CatalogNotice
      v-else-if="error"
      tone="alert"
      title="Product could not load"
      description="Try again in a moment or return to the catalog."
    >
      <UButton
        to="/products"
        color="neutral"
        variant="outline"
      >
        Back to equipment
      </UButton>
    </CatalogNotice>

    <div
      v-else-if="product"
      class="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]"
    >
      <ProductGallery
        :name="product.name"
        :slug="product.slug"
        :images="product.images"
        :category-slug="product.category.slug"
      />

      <div>
        <p class="text-xs uppercase tracking-wider text-lumen-700">
          {{ product.category.name }}
        </p>
        <span
          v-if="product.comingSoon"
          class="mt-3 inline-flex rounded-full bg-[#12201a] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white"
        >
          Coming soon
        </span>
        <h1 class="font-display mt-2 text-2xl break-words text-stone-900 sm:text-4xl">
          {{ product.name }}
        </h1>
        <p class="mt-3 text-stone-600">
          {{ product.shortDescription || product.description }}
        </p>

        <dl
          v-if="priceRows.length"
          class="mt-8 grid gap-3 text-sm"
        >
          <div
            v-for="(row, index) in priceRows"
            :key="row.key"
            class="flex justify-between gap-4 border-b border-stone-200 pb-3 last:border-0 last:pb-0"
            :class="index === 0 ? 'font-medium' : ''"
          >
            <dt class="text-stone-500">
              {{ row.label }}
            </dt>
            <dd class="text-stone-900">
              {{ formatMoney(row.amount) }}
            </dd>
          </div>
        </dl>

        <CatalogNotice
          v-if="product.comingSoon"
          class="mt-6"
          title="Coming soon"
          description="This kit is not open for booking yet. Check back when it is listed as available."
        />

        <template v-else>
          <p class="mt-6 text-sm leading-6 text-[#5b6b64]">
            {{ product.availableQuantity }} {{ product.availableQuantity === 1 ? 'unit is' : 'units are' }} listed right now. Check dates below before you request it.
          </p>

          <AvailabilityChecker
            class="mt-6"
            :product-uuid="product.uuid"
            :product-slug="product.slug"
            :initial-starts-on="typeof route.query.startsOn === 'string' ? route.query.startsOn : undefined"
            :initial-ends-on="typeof route.query.endsOn === 'string' ? route.query.endsOn : undefined"
          />
        </template>
      </div>

      <div class="space-y-8 lg:col-span-2">
        <div
          v-if="isAdmin && product.uuid"
          class="flex justify-end"
        >
          <UButton
            :to="`/admin/products/${product.uuid}`"
            color="neutral"
            variant="outline"
            size="sm"
          >
            Edit kit details
          </UButton>
        </div>

        <section v-if="product.description">
          <h2 class="text-lg font-medium text-stone-900">
            About this kit
          </h2>
          <p class="mt-3 whitespace-pre-line text-sm leading-7 text-stone-600">
            {{ product.description }}
          </p>
        </section>

        <section v-if="specEntries.length">
          <h2 class="text-lg font-medium text-stone-900">
            Specifications
          </h2>
          <dl class="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div
              v-for="[key, value] in specEntries"
              :key="key"
              class="rounded-lg border border-stone-200 bg-white px-4 py-3"
            >
              <dt class="text-stone-500">
                {{ key }}
              </dt>
              <dd class="mt-1 text-stone-900">
                {{ value }}
              </dd>
            </div>
          </dl>
        </section>

        <section v-if="product.includedAccessories.length">
          <h2 class="text-lg font-medium text-stone-900">
            Included accessories
          </h2>
          <ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-stone-600">
            <li
              v-for="item in product.includedAccessories"
              :key="item"
            >
              {{ item }}
            </li>
          </ul>
        </section>

        <section v-if="product.rentalRules">
          <h2 class="text-lg font-medium text-stone-900">
            Rental rules
          </h2>
          <p class="mt-3 whitespace-pre-line text-sm leading-7 text-stone-600">
            {{ product.rentalRules }}
          </p>
        </section>
      </div>
    </div>
  </section>
</template>
