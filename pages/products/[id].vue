<script setup lang="ts">
import type { CatalogProduct } from '~/types/catalog'
import { breadcrumbJsonLd, productJsonLd } from '~/utils/seo'

const route = useRoute()
const identifier = computed(() => String(route.params.id))
const { isAuthenticated } = useAuth()
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
const rentPath = computed(() => ({
  path: '/rentals/new',
  query: { product: product.value?.slug || identifier.value },
}))
const rentTo = computed(() => ({
  path: '/login',
  query: { redirect: `/rentals/new?product=${product.value?.slug || identifier.value}` },
}))
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 py-16 sm:px-6 lg:px-8">
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
        <h1 class="font-display mt-2 text-4xl text-stone-900">
          {{ product.name }}
        </h1>
        <p class="mt-3 text-stone-600">
          {{ product.shortDescription || product.description }}
        </p>

        <dl class="mt-8 grid gap-3 text-sm">
          <div class="flex justify-between gap-4 border-b border-stone-200 pb-3">
            <dt class="text-stone-500">
              Daily
            </dt>
            <dd class="font-medium text-stone-900">
              {{ formatMoney(product.dailyPrice) }}
            </dd>
          </div>
          <div
            v-if="product.weeklyPrice !== null"
            class="flex justify-between gap-4 border-b border-stone-200 pb-3"
          >
            <dt class="text-stone-500">
              Weekly
            </dt>
            <dd class="text-stone-900">
              {{ formatMoney(product.weeklyPrice) }}
            </dd>
          </div>
          <div
            v-if="product.monthlyPrice !== null"
            class="flex justify-between gap-4 border-b border-stone-200 pb-3"
          >
            <dt class="text-stone-500">
              Monthly
            </dt>
            <dd class="text-stone-900">
              {{ formatMoney(product.monthlyPrice) }}
            </dd>
          </div>
          <div class="flex justify-between gap-4 border-b border-stone-200 pb-3">
            <dt class="text-stone-500">
              Deposit
            </dt>
            <dd class="text-stone-900">
              {{ formatMoney(product.depositAmount) }}
            </dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-stone-500">
              Late fee
            </dt>
            <dd class="text-stone-900">
              {{ formatMoney(product.lateFee) }}
            </dd>
          </div>
        </dl>

        <p class="mt-6 text-sm text-stone-500">
          {{ product.availableQuantity }} listed on the shelf right now. Use the date check below for overlapping bookings.
        </p>

        <AvailabilityChecker
          class="mt-6"
          :product-uuid="product.uuid"
          :product-slug="product.slug"
          :initial-starts-on="typeof route.query.startsOn === 'string' ? route.query.startsOn : undefined"
          :initial-ends-on="typeof route.query.endsOn === 'string' ? route.query.endsOn : undefined"
        />

        <div class="mt-8 flex flex-col gap-3 sm:flex-row">
          <UButton
            v-if="!isAuthenticated"
            :to="rentTo"
            size="lg"
          >
            Sign in to rent
          </UButton>
          <UButton
            v-else
            :to="rentPath"
            size="lg"
          >
            Rent now
          </UButton>
          <UButton
            to="/products"
            size="lg"
            color="neutral"
            variant="outline"
          >
            Browse more
          </UButton>
        </div>
        <p
          v-if="isAuthenticated"
          class="mt-3 text-sm text-stone-500"
        >
          Choose dates and confirm your details to submit a rental request.
        </p>
      </div>

      <div class="space-y-8 lg:col-span-2">
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
