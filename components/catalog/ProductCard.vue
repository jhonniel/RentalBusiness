<script setup lang="ts">
import type { CatalogProduct } from '~/types/catalog'
import { catalogCardRate } from '~/utils/price-visibility'
import { productHighlights, productVisual, resolvedProductImage } from '~/utils/storefront'

const props = defineProps<{
  product: CatalogProduct
}>()

const { formatMoney } = useCurrency()
const image = computed(() => props.product.images[0])
const highlights = computed(() => productHighlights(props.product))
const cardRate = computed(() => catalogCardRate(props.product))
const fallback = computed(() => productVisual(props.product.slug, props.product.category.slug))
const src = ref(resolvedProductImage(props.product.slug, props.product.category.slug, image.value?.url))

watch(image, (next) => {
  src.value = resolvedProductImage(props.product.slug, props.product.category.slug, next?.url)
})

function useFallback() {
  src.value = fallback.value
}
</script>

<template>
  <article class="flex h-full flex-col bg-white">
    <NuxtLink
      :to="`/products/${product.slug}`"
      class="flex flex-1 flex-col"
    >
      <div class="relative flex h-44 shrink-0 items-center justify-center bg-white px-4 py-6 sm:h-56 sm:px-6 sm:py-8">
        <span
          v-if="product.comingSoon"
          class="absolute left-4 top-4 rounded-full bg-[#12201a] px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white"
        >
          Coming soon
        </span>
        <img
          :src="src"
          :alt="product.name"
          loading="lazy"
          decoding="async"
          class="h-full w-full bg-white object-contain"
          @error="useFallback"
        >
      </div>
      <div class="flex flex-1 flex-col px-5 pb-5 pt-4">
        <h3 class="line-clamp-2 min-h-12 font-semibold leading-6 text-[#12201a]">
          {{ product.name }}
        </h3>
        <ul
          v-if="highlights.length"
          class="mt-2 min-h-[3.75rem] space-y-1 text-xs leading-5 text-[#5b6b64]"
        >
          <li
            v-for="item in highlights"
            :key="item"
          >
            {{ item }}
          </li>
        </ul>
        <p
          v-else
          class="mt-2 line-clamp-3 min-h-[3.75rem] text-xs leading-5 text-[#5b6b64]"
        >
          {{ product.shortDescription || product.description }}
        </p>
        <p
          v-if="cardRate"
          class="mt-auto pt-4 text-sm font-semibold text-[#12201a]"
        >
          {{ formatMoney(cardRate.amount) }}
          <span class="font-normal text-[#5b6b64]">{{ cardRate.suffix }}</span>
        </p>
      </div>
    </NuxtLink>
    <div class="px-5 pb-5">
      <UButton
        :to="`/products/${product.slug}`"
        color="neutral"
        variant="outline"
        block
        class="rounded-full"
      >
        {{ product.comingSoon ? 'View details' : 'Rent' }}
        <UIcon
          :name="product.comingSoon ? 'i-lucide-arrow-right' : 'i-lucide-plus'"
          class="size-4"
        />
      </UButton>
    </div>
  </article>
</template>
