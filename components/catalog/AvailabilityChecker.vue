<script setup lang="ts">
import type { AvailabilityResponse } from '~/types/availability'
import { calendarDateInZone } from '~/utils/datetime'

const props = defineProps<{
  productUuid: string
  productSlug: string
  initialStartsOn?: string
  initialEndsOn?: string
}>()

const { isAuthenticated } = useAuth()
const today = calendarDateInZone()
const startsOn = ref(props.initialStartsOn || today)
const endsOn = ref(props.initialEndsOn || today)
const pending = ref(false)
const formError = ref('')
const result = ref<AvailabilityResponse | null>(null)

watch([startsOn, endsOn], () => {
  result.value = null
  formError.value = ''
})

const rentQuery = computed(() => ({
  product: props.productSlug,
  startsOn: startsOn.value,
  endsOn: endsOn.value,
  quantity: '1',
}))

const rentTo = computed(() => {
  if (!isAuthenticated.value) {
    const next = `/rentals/new?product=${props.productSlug}&startsOn=${startsOn.value}&endsOn=${endsOn.value}&quantity=1`
    return { path: '/login', query: { redirect: next } }
  }

  return { path: '/rentals/new', query: rentQuery.value }
})

async function loadAvailability() {
  return $fetch<AvailabilityResponse>('/api/availability', {
    query: {
      productUuid: props.productUuid,
      productSlug: props.productSlug,
      startsOn: startsOn.value,
      endsOn: endsOn.value,
      quantity: 1,
    },
  })
}

async function onSubmit() {
  formError.value = ''
  result.value = null
  pending.value = true

  try {
    result.value = await loadAvailability()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not check those dates.'
  }
  finally {
    pending.value = false
  }
}

async function goRent() {
  formError.value = ''
  pending.value = true

  try {
    result.value = await loadAvailability()
    if (!result.value.canFulfill) {
      formError.value = 'Those dates are not available. Another request already holds that kit.'
      return
    }
    await navigateTo(rentTo.value)
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
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
    class="rounded-2xl border border-[#12201a]/8 bg-[#f7f8f7] p-5 font-[system-ui,sans-serif] tracking-normal sm:p-6"
    method="post"
    @submit.prevent="onSubmit"
  >
    <div>
      <h2 class="text-lg font-semibold text-[#12201a]">
        Check availability
      </h2>
      <p class="mt-1 text-sm leading-6 text-[#5b6b64]">
        Confirm this kit is free for the days you need it.
      </p>
    </div>

    <div class="mt-5 grid gap-4 sm:grid-cols-2">
      <BookingDateField
        v-model="startsOn"
        label="Start date"
        :product-uuid="productUuid"
        :product-slug="productSlug"
        :quantity="1"
        :until="endsOn || undefined"
        :disabled="pending"
      />
      <BookingDateField
        v-model="endsOn"
        label="End date"
        :product-uuid="productUuid"
        :product-slug="productSlug"
        :quantity="1"
        :min="startsOn || undefined"
        :disabled="pending"
      />
    </div>

    <AuthAlert
      v-if="formError"
      class="mt-4"
      :description="formError"
    />

    <div
      v-if="result"
      class="mt-4 rounded-xl px-4 py-3 text-sm leading-6"
      :class="result.canFulfill ? 'bg-white text-[#12201a] ring-1 ring-[#12201a]/8' : 'bg-red-50 text-red-900'"
      role="status"
    >
      <p v-if="result.canFulfill">
        Available for these dates. {{ result.available }} of {{ result.capacity }} units are free.
      </p>
      <p v-else>
        Those dates are not fully free. {{ result.available }} of {{ result.capacity }} units remain.
      </p>
    </div>

    <div class="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
      <UButton
        type="submit"
        color="neutral"
        variant="outline"
        class="w-full justify-center rounded-full tracking-normal sm:w-auto"
        :loading="pending"
      >
        Check dates
      </UButton>
      <UButton
        color="neutral"
        class="w-full justify-center rounded-full bg-[#12201a] tracking-normal text-white hover:bg-[#1b2d26] sm:w-auto"
        :disabled="Boolean(result && !result.canFulfill)"
        @click="goRent"
      >
        {{ isAuthenticated ? 'Rent now' : 'Sign in to rent' }}
      </UButton>
      <UButton
        to="/products"
        color="neutral"
        variant="ghost"
        class="w-full justify-center rounded-full tracking-normal sm:w-auto"
      >
        Browse catalog
      </UButton>
    </div>
    <p class="mt-3 text-xs leading-5 text-[#5b6b64]">
      {{ isAuthenticated
        ? 'After you confirm dates, you can submit a rental request.'
        : 'Sign in to send a rental request for these dates.' }}
    </p>
  </form>
</template>
