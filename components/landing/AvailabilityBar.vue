<script setup lang="ts">
import type { CatalogProduct } from '~/types/catalog'
import { calendarDateInZone } from '~/utils/datetime'
import { addCalendarDays } from '~/utils/expense'
import { DEFAULT_PICKUP_TIME, defaultRentalReturnOn, formatRentalReturnLabel, resolveRentalWindow } from '~/utils/rental-window'

const props = defineProps<{
  products: CatalogProduct[]
}>()

const router = useRouter()
const today = calendarDateInZone()
const productSlug = ref('')
const startsOn = ref(today)
const pickupTime = ref(DEFAULT_PICKUP_TIME)
const endsOn = ref(defaultRentalReturnOn(today))

const bookableProducts = computed(() => props.products.filter(product => !product.comingSoon))
const selected = computed(() => bookableProducts.value.find(product => product.slug === productSlug.value))
const window = computed(() => resolveRentalWindow({
  startsOn: startsOn.value,
  endsOn: endsOn.value,
  pickupTime: pickupTime.value,
}))

watch(startsOn, (value, previous) => {
  if (endsOn.value <= value || (previous && endsOn.value === defaultRentalReturnOn(previous))) {
    endsOn.value = defaultRentalReturnOn(value)
  }
})

function onSubmit() {
  if (selected.value) {
    router.push({
      path: `/products/${selected.value.slug}`,
      query: {
        startsOn: window.value.startsOn,
        endsOn: window.value.endsOn,
        pickupTime: window.value.pickupTime,
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
      <div class="grid items-end gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,1fr)_auto]">
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
              v-for="product in bookableProducts"
              :key="product.uuid"
              :value="product.slug"
            >
              {{ product.name }}
            </option>
          </select>
        </label>

        <BookingDateField
          v-model="startsOn"
          label="Pickup date"
          :product-slug="productSlug || undefined"
          :until="endsOn || undefined"
        />
        <BookingPickupTime
          v-model="pickupTime"
          :product-slug="productSlug || undefined"
          :starts-on="startsOn"
          :ends-on="endsOn"
        />
        <BookingDateField
          v-model="endsOn"
          label="Return date"
          :product-slug="productSlug || undefined"
          :min="addCalendarDays(startsOn, 1)"
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
      <p class="mt-3 text-xs leading-5 text-[#5b6b64]">
        Return {{ formatRentalReturnLabel(window.endsOn, window.pickupTime) }}
      </p>
    </form>
  </section>
</template>
