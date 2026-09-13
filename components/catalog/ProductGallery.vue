<script setup lang="ts">
import type { PublicProductImage } from '~/types/catalog'
import { categoryVisual, resolvedProductImage } from '~/utils/storefront'

const props = defineProps<{
  name: string
  images: PublicProductImage[]
  categorySlug?: string
  slug?: string
}>()

const fallback = computed(() => categoryVisual(props.categorySlug || ''))
const photos = computed(() => props.images)

const active = ref(0)
const current = computed(() => photos.value[active.value] ?? null)
const mainSrc = ref(resolvedProductImage(props.slug || '', props.categorySlug, current.value?.url))

watch(current, (next) => {
  mainSrc.value = resolvedProductImage(props.slug || '', props.categorySlug, next?.url)
})

function useFallback(event: Event) {
  const target = event.target as HTMLImageElement
  if (target.src !== fallback.value) {
    target.src = fallback.value
  }
}

watch(() => props.images, () => {
  active.value = 0
})

function show(index: number) {
  if (index < 0 || index >= photos.value.length) {
    return
  }
  active.value = index
}
</script>

<template>
  <div>
    <div class="bg-white">
      <img
        :src="mainSrc"
        :alt="current?.alt || name"
        width="1200"
        height="900"
        decoding="async"
        class="h-auto max-h-56 w-full bg-white object-contain sm:max-h-72 lg:max-h-[28rem]"
        @error="useFallback"
      >
    </div>
    <div
      v-if="photos.length > 1"
      class="mt-4"
    >
      <p class="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-[#5b6b64]">
        More photos
      </p>
      <div class="grid grid-cols-4 gap-2 sm:grid-cols-5">
        <button
          v-for="(image, index) in photos"
          :key="image.uuid"
          type="button"
          class="overflow-hidden rounded-lg border bg-white p-2"
          :class="index === active ? 'border-[#12201a]' : 'border-stone-200'"
          :aria-label="`Show image ${index + 1}`"
          :aria-pressed="index === active"
          @click="show(index)"
        >
          <img
            :src="image.url"
            :alt="image.alt || name"
            loading="lazy"
            decoding="async"
            class="aspect-square w-full object-contain"
            @error="useFallback"
          >
        </button>
      </div>
    </div>
  </div>
</template>
