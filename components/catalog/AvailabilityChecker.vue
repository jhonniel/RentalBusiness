<script setup lang="ts">
import type { AvailabilityResponse } from '~/types/availability'
import { calendarDateInZone } from '~/utils/datetime'

const props = defineProps<{
  productUuid: string
  productSlug: string
  initialStartsOn?: string
  initialEndsOn?: string
}>()

const today = calendarDateInZone()
const startsOn = ref(props.initialStartsOn || today)
const endsOn = ref(props.initialEndsOn || today)
const quantity = ref(1)
const pending = ref(false)
const formError = ref('')
const result = ref<AvailabilityResponse | null>(null)

async function onSubmit() {
  formError.value = ''
  result.value = null
  pending.value = true

  try {
    result.value = await $fetch<AvailabilityResponse>('/api/availability', {
      query: {
        productUuid: props.productUuid,
        productSlug: props.productSlug,
        startsOn: startsOn.value,
        endsOn: endsOn.value,
        quantity: quantity.value,
      },
    })
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string, statusCode?: number } }).data
      : null
    formError.value = payload?.message || 'We could not check those dates.'
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <form
    class="rounded-2xl border border-stone-200 bg-white p-5"
    method="post"
    @submit.prevent="onSubmit"
  >
    <h2 class="text-sm font-medium text-stone-900">
      Check dates
    </h2>
    <p class="mt-1 text-sm text-stone-500">
      Availability counts overlapping rentals, not only the number on the shelf.
    </p>

    <div class="mt-4 grid gap-3 sm:grid-cols-3">
      <BookingDateField
        v-model="startsOn"
        label="Start"
        :product-uuid="productUuid"
        :product-slug="productSlug"
        :quantity="Number(quantity) || 1"
        :disabled="pending"
      />
      <BookingDateField
        v-model="endsOn"
        label="End"
        :product-uuid="productUuid"
        :product-slug="productSlug"
        :quantity="Number(quantity) || 1"
        :min="startsOn || undefined"
        :disabled="pending"
      />
      <label class="block text-sm">
        <span class="mb-1.5 block text-stone-700">Quantity</span>
        <UInput
          v-model="quantity"
          type="number"
          min="1"
          max="99"
          :disabled="pending"
        />
      </label>
    </div>

    <AuthAlert
      v-if="formError"
      class="mt-4"
      :description="formError"
    />

    <div
      v-if="result"
      class="mt-4 rounded-lg px-4 py-3 text-sm"
      :class="result.canFulfill ? 'bg-lumen-50 text-lumen-900' : 'bg-red-50 text-red-900'"
      role="status"
    >
      <p v-if="result.canFulfill">
        {{ result.available }} of {{ result.capacity }} units are free for these dates.
      </p>
      <p v-else>
        Only {{ result.available }} of {{ result.capacity }} units are free. {{ result.booked }} are already booked in this range.
      </p>
    </div>

    <div class="mt-4 flex flex-wrap gap-2">
      <UButton
        type="submit"
        :loading="pending"
      >
        Check availability
      </UButton>
      <UButton
        v-if="result?.canFulfill"
        :to="{
          path: '/rentals/new',
          query: {
            product: productSlug,
            startsOn: startsOn,
            endsOn: endsOn,
            quantity: String(quantity),
          },
        }"
        color="neutral"
        variant="outline"
      >
        Continue to request
      </UButton>
    </div>
  </form>
</template>
