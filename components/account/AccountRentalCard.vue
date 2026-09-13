<script setup lang="ts">
import type { PublicRental } from '~/types/rental'
import { formatBookingDate } from '~/utils/datetime'
import { customerRentalNextLabel } from '~/utils/rental'
import { productVisual } from '~/utils/storefront'

const props = defineProps<{
  rental: PublicRental
  to: string
  action?: boolean
  amount?: boolean
}>()

const { formatMoney } = useCurrency()
const firstItem = computed(() => props.rental.items[0])
const name = computed(() => {
  const productName = firstItem.value?.product.name || props.rental.code
  const extra = props.rental.items.length - 1
  return extra > 0 ? `${productName} + ${extra} more` : productName
})
const kitImage = computed(() =>
  firstItem.value
    ? productVisual(firstItem.value.product.slug)
    : '/storefront/action-camera.png',
)
const nextLabel = computed(() => customerRentalNextLabel(props.rental))
</script>

<template>
  <NuxtLink
    :to="to"
    class="flex items-start gap-3 p-3 transition-colors hover:bg-[#f7f8f7] sm:items-center sm:justify-between sm:px-4"
  >
    <div class="flex min-w-0 flex-1 items-center gap-3">
      <div class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#eef1ef] ring-1 ring-[#12201a]/6">
        <img
          :src="kitImage"
          :alt="name"
          class="size-full object-contain p-2"
        >
      </div>
      <div class="min-w-0">
        <p class="truncate font-semibold text-[#12201a]">
          {{ name }}
        </p>
        <p class="mt-1 text-sm break-words text-[#5c6a64]">
          {{ rental.code }}
          ·
          {{ formatBookingDate(rental.startsOn) }}
          –
          {{ formatBookingDate(rental.endsOn) }}
        </p>
      </div>
    </div>
    <div class="flex shrink-0 flex-col items-end gap-1.5 sm:flex-row sm:flex-wrap sm:items-center">
      <AccountStatus :status="rental.status" />
      <span
        v-if="amount"
        class="text-sm font-semibold text-[#12201a]"
      >
        {{ formatMoney(rental.totalAmount) }}
      </span>
      <span
        v-if="action && nextLabel"
        class="inline-flex rounded-lg bg-[#12201a] px-3 py-1.5 text-xs font-semibold text-white"
      >
        {{ nextLabel }}
      </span>
    </div>
  </NuxtLink>
</template>
