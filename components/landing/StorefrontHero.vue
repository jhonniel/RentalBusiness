<script setup lang="ts">
import type { CatalogProduct } from '~/types/catalog'
import { resolvedProductImage } from '~/utils/storefront'

const props = defineProps<{
  products?: CatalogProduct[]
}>()

function heroImage(slug: string, categorySlug: string) {
  const product = props.products?.find(item => item.slug === slug)
  return resolvedProductImage(slug, categorySlug, product?.images[0]?.url)
}
</script>

<template>
  <section class="bg-white">
    <div class="mx-auto grid max-w-7xl items-center gap-10 bg-white px-4 pb-16 pt-12 sm:px-6 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:px-8 lg:pb-20 lg:pt-16">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#5b6b64]">
          Cameras / Drones / Starlink
        </p>
        <h1 class="font-display mt-4 max-w-xl text-5xl leading-[1.05] text-[#12201a] sm:text-6xl">
          Premium Gear for Your Next Adventure
        </h1>
        <p class="mt-5 max-w-md text-base leading-7 text-[#4a5a54]">
          Rent high-quality equipment for travel, events, content, and more. Simple. Secure. Hassle-free.
        </p>
        <UButton
          to="/products"
          color="neutral"
          size="lg"
          class="mt-8 rounded-full px-5"
        >
          Browse Equipment
          <UIcon
            name="i-lucide-arrow-right"
            class="size-4"
          />
        </UButton>
      </div>

      <div class="grid grid-cols-[1.05fr_1fr_0.85fr] items-center gap-6 bg-white">
        <NuxtLink
          to="/products/starlink-mini"
          class="block bg-transparent"
        >
          <img
            :src="heroImage('starlink-mini', 'starlink')"
            alt="Starlink Mini"
            class="h-auto w-full object-contain"
          >
        </NuxtLink>
        <NuxtLink
          to="/products/dji-air-3"
          class="block bg-transparent"
        >
          <img
            :src="heroImage('dji-air-3', 'drones')"
            alt="DJI drone"
            class="h-auto w-full object-contain"
          >
        </NuxtLink>
        <NuxtLink
          to="/products?category=cameras"
          class="block bg-transparent"
        >
          <img
            :src="heroImage('sony-a7-iv', 'cameras')"
            alt="DJI Osmo 360"
            class="mx-auto h-auto w-[70%] object-contain"
          >
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
