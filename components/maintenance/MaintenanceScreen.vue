<script setup lang="ts">
import type { PublicMaintenanceImage } from '~/types/maintenance'
import { APP_NAME, BUSINESS_EMAIL } from '~/utils/constants'

defineProps<{
  title: string
  message: string
  images: PublicMaintenanceImage[]
}>()
</script>

<template>
  <div class="mx-auto flex min-h-dvh w-full max-w-4xl flex-col px-4 py-8 sm:px-6 sm:py-12">
    <div class="flex justify-center">
      <AppLogo />
    </div>

    <div class="flex flex-1 flex-col items-center justify-center py-10 text-center">
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

      <p class="mt-10 text-sm text-[#5b6b64]">
        Questions? Email
        <a
          :href="`mailto:${BUSINESS_EMAIL}`"
          class="font-medium text-[#12201a] underline decoration-[#12201a]/20 underline-offset-4"
        >{{ BUSINESS_EMAIL }}</a>
      </p>
    </div>
  </div>
</template>
