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
      class="storefront-card rounded-3xl p-4 tracking-normal sm:rounded-[1.75rem] sm:p-5"
      @submit.prevent="onSubmit"
    >
      <div class="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <label class="block text-sm tracking-normal">
          <span class="mb-2 block text-xs font-medium text-[#5b6b64]">Find your gear</span>
          <select
            v-model="productSlug"
            class="h-12 w-full rounded-xl border border-[#12201a]/12 bg-white px-3.5 text-sm tracking-normal text-[#12201a]"
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
          class="h-12 w-full justify-center rounded-full px-6 tracking-normal sm:col-span-2 lg:col-span-1 lg:w-auto"
        >
          <UIcon
            name="i-lucide-search"
            class="size-4"
          />
          <span class="tracking-normal">Check availability</span>
        </UButton>
      </div>

      <ul class="mt-4 hidden flex-wrap gap-x-5 gap-y-2 border-t border-[#12201a]/8 pt-4 text-xs tracking-normal text-[#5b6b64] lg:flex">
        <li class="flex items-center gap-1.5">
          <UIcon name="i-lucide-shield-check" class="size-3.5" />
          Secure booking
        </li>
        <li class="flex items-center gap-1.5">
          <UIcon name="i-lucide-zap" class="size-3.5" />
          Instant confirmation
        </li>
        <li class="flex items-center gap-1.5">
          <UIcon name="i-lucide-headphones" class="size-3.5" />
          Customer support
        </li>
      </ul>
    </form>
  </section>
</template>
