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
const mainSrc = computed(() => (
  current.value?.url || resolvedProductImage(props.slug || '', props.categorySlug)
))

function useFallback(event: Event) {
  const target = event.target as HTMLImageElement
  if (target.src !== fallback.value) {
    target.src = fallback.value
  }
}

watch(() => props.images, () => {
  active.value = 0
})

const carousel = ref<{ emblaApi?: { scrollTo: (index: number) => void } | null } | null>(null)
const thumbs = ref<HTMLElement | null>(null)

function show(index: number) {
  if (index < 0 || index >= photos.value.length) {
    return
  }
  active.value = index
  carousel.value?.emblaApi?.scrollTo(index)
}

function onSelect(index: number) {
  active.value = index
  const thumb = thumbs.value?.children[index] as HTMLElement | undefined
  const row = thumbs.value
  if (thumb && row) {
    const offset = thumb.getBoundingClientRect().left - row.getBoundingClientRect().left + row.scrollLeft
    const left = Math.max(0, Math.min(offset - (row.clientWidth - thumb.clientWidth) / 2, row.scrollWidth - row.clientWidth))
    row.scrollTo({ left, behavior: 'smooth' })
  }
}
</script>

<template>
  <div>
    <UCarousel
      v-if="photos.length > 1"
      ref="carousel"
      v-slot="{ item }"
      :items="photos"
      loop
      :duration="30"
      :autoplay="{ delay: 3500, stopOnInteraction: false, stopOnMouseEnter: true }"
      arrows
      dots
      prev-icon="i-lucide-chevron-left"
      next-icon="i-lucide-chevron-right"
      :prev="{ color: 'neutral', variant: 'outline', size: 'sm' }"
      :next="{ color: 'neutral', variant: 'outline', size: 'sm' }"
      :ui="{
        item: 'basis-full',
        prev: 'start-2 sm:start-3 rounded-full bg-white/90 shadow-sm',
        next: 'end-2 sm:end-3 rounded-full bg-white/90 shadow-sm',
        dots: '-bottom-6',
        dot: 'size-1.5',
      }"
      class="bg-white"
      @select="onSelect"
    >
      <img
        :src="(item as PublicProductImage).url"
        :alt="(item as PublicProductImage).alt || name"
        width="1200"
        height="900"
        decoding="async"
        class="mx-auto h-56 w-full bg-white object-contain sm:h-72 lg:h-[28rem]"
        @error="useFallback"
      >
    </UCarousel>
    <div
      v-else
      class="bg-white"
    >
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
      class="mt-10"
    >
      <p class="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-[#5b6b64]">
        More photos
      </p>
      <div
        ref="thumbs"
        class="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        <button
          v-for="(image, index) in photos"
          :key="image.uuid"
          type="button"
          class="w-[calc((100%-1.5rem)/4)] shrink-0 overflow-hidden rounded-lg border bg-white p-2 transition-colors sm:w-[calc((100%-2rem)/5)]"
          :class="index === active ? 'border-[#12201a] ring-1 ring-[#12201a]' : 'border-stone-200 hover:border-stone-400'"
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
