<script setup lang="ts">
import type { PublicMaintenanceImage, PublicMaintenanceProduct } from '~/types/maintenance'
import { APP_NAME, BUSINESS_EMAIL } from '~/utils/constants'
import { resolvedProductImage } from '~/utils/storefront'

defineProps<{
  title: string
  message: string
  images: PublicMaintenanceImage[]
  products: PublicMaintenanceProduct[]
}>()
</script>

<template>
  <div class="mx-auto flex min-h-dvh w-full max-w-6xl flex-col px-4 py-8 sm:px-6 sm:py-12">
    <div class="flex justify-center">
      <AppLogo />
    </div>

    <div class="mt-8 grid flex-1 gap-10 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,26rem)] xl:items-start">
      <div class="flex flex-col items-center justify-center py-4 text-center xl:py-10">
        <p class="text-xs font-semibold uppercase tracking-[0.22em] text-[#5b6b64]">
          Maintenance
        </p>
        <h1 class="font-display mt-4 text-3xl text-[#12201a] sm:text-5xl">
          {{ title }}
        </h1>
        <p class="mt-5 max-w-2xl whitespace-pre-line text-base leading-7 text-[#3b4a44] sm:text-lg">
          {{ message }}
        </p>

        <div
          v-if="products.length"
          class="mt-12 grid w-full grid-cols-3 items-end gap-3 sm:gap-8"
        >
          <figure
            v-for="product in products"
            :key="product.slug"
            class="min-w-0"
          >
            <img
              :src="resolvedProductImage(product.slug, product.categorySlug, product.imageUrl)"
              :alt="product.name"
              class="mx-auto max-h-40 w-full object-contain sm:max-h-56 lg:max-h-64"
            >
            <figcaption class="mt-3 text-xs font-medium text-[#12201a] sm:text-sm">
              {{ product.name }}
            </figcaption>
          </figure>
        </div>

        <div
          v-if="images.length"
          class="mt-10 w-full"
          :class="images.length === 1 ? 'mx-auto max-w-2xl' : 'grid gap-4 sm:grid-cols-2'"
        >
          <figure
            v-for="image in images"
            :key="image.uuid"
            class="overflow-hidden rounded-2xl border border-[#12201a]/8 bg-white shadow-[0_18px_40px_rgb(18_32_26_/_6%)]"
          >
            <img
              :src="image.url"
              :alt="image.alt || `${APP_NAME} maintenance`"
              class="max-h-[28rem] w-full object-cover"
            >
          </figure>
        </div>
      </div>

      <MaintenanceChat />
    </div>

    <p class="mt-10 text-center text-sm text-[#5b6b64]">
      Questions? Email
      <a
        :href="`mailto:${BUSINESS_EMAIL}`"
        class="font-medium text-[#12201a] underline decoration-[#12201a]/20 underline-offset-4"
      >{{ BUSINESS_EMAIL }}</a>
    </p>
  </div>
</template>
