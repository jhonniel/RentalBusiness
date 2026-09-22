<script setup lang="ts">
import type { CatalogProduct } from '~/types/catalog'

defineProps<{
  products: CatalogProduct[]
}>()
</script>

<template>
  <section class="mx-auto max-w-7xl bg-white px-4 py-16 sm:px-6 lg:px-8">
    <div class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
      <div class="min-w-0">
        <h2 class="text-xl font-semibold tracking-tight text-[#12201a] sm:text-2xl">
          Available equipment
        </h2>
        <p class="mt-1 text-sm text-[#5b6b64]">
          Everything currently listed for rent.
        </p>
      </div>
      <UButton
        to="/products"
        color="neutral"
        variant="ghost"
        class="rounded-full"
      >
        View catalog
        <UIcon
          name="i-lucide-arrow-right"
          class="size-4"
        />
      </UButton>
    </div>

    <div class="mt-8 grid items-stretch gap-6 sm:grid-cols-2 lg:grid-cols-3">
      <ProductCard
        v-for="product in products"
        :key="product.uuid"
        :product="product"
      />
    </div>
  </section>
</template>
