<script setup lang="ts">
import type { CatalogListResponse } from '~/types/catalog'
import { APP_DESCRIPTION } from '~/utils/constants'
import { howToJsonLd, organizationJsonLd, websiteJsonLd } from '~/utils/seo'

useSiteMeta({
  title: 'Equipment Rentals in Davao City',
  description: APP_DESCRIPTION,
  path: '/',
})

const config = useRuntimeConfig()
const origin = String(config.public.siteUrl || 'http://localhost:3000')
useHead({
  script: [
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify(organizationJsonLd(origin)),
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify(websiteJsonLd(origin)),
    },
    {
      type: 'application/ld+json',
      innerHTML: JSON.stringify(howToJsonLd()),
    },
  ],
})

const { data: catalog } = await useFetch<CatalogListResponse>('/api/products', {
  query: { pageSize: 24 },
})

const catalogProducts = computed(() => catalog.value?.items ?? [])
</script>

<template>
  <div>
    <StorefrontHero />
    <AvailabilityBar :products="catalogProducts" />
    <FeaturedRentals
      v-if="catalogProducts.length"
      :products="catalogProducts"
    />
    <HowItWorks />
  </div>
</template>
