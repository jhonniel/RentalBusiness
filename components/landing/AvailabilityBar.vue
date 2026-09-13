<script setup lang="ts">
import type { CatalogProduct } from '~/types/catalog'
import { calendarDateInZone } from '~/utils/datetime'

const props = defineProps<{
  products: CatalogProduct[]
}>()

const router = useRouter()
const today = calendarDateInZone()
const productSlug = ref('')
const startsOn = ref(today)
const endsOn = ref(today)

const selected = computed(() => props.products.find(product => product.slug === productSlug.value))

function onSubmit() {
  if (selected.value) {
    router.push({
      path: `/products/${selected.value.slug}`,
      query: {
        startsOn: startsOn.value,
        endsOn: endsOn.value,
      },
    })
    return
  }

  router.push('/products')
}
</script>

<template>
  <section class="relative z-10 mx-auto -mt-6 max-w-7xl px-4 sm:-mt-12 sm:px-6 lg:px-8">
    <form
      class="storefront-card grid items-end gap-4 rounded-3xl p-4 sm:grid-cols-2 sm:rounded-[1.75rem] sm:p-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto_auto]"
      @submit.prevent="onSubmit"
    >
      <label class="block text-sm">
        <span class="mb-1.5 block text-xs font-medium text-[#5b6b64]">Find your gear</span>
        <select
          v-model="productSlug"
          class="w-full rounded-xl border border-[#12201a]/10 bg-white px-3 py-2.5 text-sm text-[#12201a]"
        >
          <option value="">
            Select equipment
          </option>
          <option
            v-for="product in products"
            :key="product.uuid"
            :value="product.slug"
          >
            {{ product.name }}
          </option>
        </select>
      </label>

      <BookingDateField
        v-model="startsOn"
        label="Start date"
        :product-slug="productSlug || undefined"
      />
      <BookingDateField
        v-model="endsOn"
        label="End date"
        :product-slug="productSlug || undefined"
        :min="startsOn || undefined"
      />

      <UButton
        type="submit"
        color="neutral"
        class="h-11 w-full rounded-full px-5 sm:col-span-2 lg:col-span-1 lg:w-auto"
      >
        <UIcon
          name="i-lucide-search"
          class="size-4"
        />
        Check availability
      </UButton>

      <div class="hidden items-center gap-4 border-l border-[#12201a]/8 pl-4 text-[11px] leading-4 text-[#5b6b64] xl:flex">
        <span class="flex items-center gap-1.5">
          <UIcon name="i-lucide-shield-check" class="size-3.5" />
          Secure Booking
        </span>
        <span class="flex items-center gap-1.5">
          <UIcon name="i-lucide-zap" class="size-3.5" />
          Instant Confirmation
        </span>
        <span class="flex items-center gap-1.5">
          <UIcon name="i-lucide-headphones" class="size-3.5" />
          Customer Support
        </span>
      </div>
    </form>
  </section>
</template>
