<script setup lang="ts">
import type { PublicRental } from '~/types/rental'
import { canReleaseCommissionerBooking } from '~/utils/commission'
import { formatBusinessDateTime } from '~/utils/datetime'

definePageMeta({
  layout: 'commissioner',
  middleware: 'commissioner',
})

const route = useRoute()
const identifier = computed(() => String(route.params.id || ''))
const toast = useToast()
const { formatMoney } = useCurrency()
const pending = ref(false)

useSiteMeta({
  title: 'Booking',
  path: `/commissioner/bookings/${identifier.value}`,
})

const { data: rental, error, refresh } = await useFetch<PublicRental>(() => `/api/commissioner/rentals/${identifier.value}`)

const canRelease = computed(() => Boolean(rental.value && canReleaseCommissionerBooking(rental.value.status)))

function clientName(booking: PublicRental) {
  if (!booking.customer) {
    return 'Client'
  }
  return `${booking.customer.firstName} ${booking.customer.lastName}`.trim() || 'Client'
}

async function cancelBooking() {
  if (!rental.value) {
    return
  }
  pending.value = true
  try {
    await $fetch(`/api/commissioner/rentals/${rental.value.uuid}/cancel`, { method: 'POST' })
    toast.add({ title: 'Booking cancelled', color: 'success' })
    await refresh()
  }
  catch (cause) {
    const payload = typeof cause === 'object' && cause && 'data' in cause
      ? (cause as { data?: { message?: string } }).data
      : null
    toast.add({ title: payload?.message || 'We could not cancel that booking.', color: 'error' })
  }
  finally {
    pending.value = false
  }
}

</script>

<template>
  <div class="mx-auto w-full max-w-xl space-y-6">
    <NuxtLink
      to="/commissioner"
      class="text-sm text-stone-500 hover:text-stone-800"
    >
      Back to bookings
    </NuxtLink>

    <AdminNotice
      v-if="error"
      title="Booking not found"
      description="This booking is not on your account."
    />

    <template v-else-if="rental">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
            {{ rental.code }}
          </p>
          <h1 class="mt-2 text-2xl font-medium text-stone-900">
            {{ rental.items[0]?.product.name || 'Equipment' }}
          </h1>
        </div>
        <StatusBadge :status="rental.status" />
      </div>

      <dl class="grid gap-3 rounded-xl border border-stone-200 bg-white p-5 text-sm">
        <div class="flex justify-between gap-4">
          <dt class="text-stone-500">Client</dt>
          <dd>{{ clientName(rental) }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-stone-500">Pickup</dt>
          <dd>{{ formatBusinessDateTime(rental.pickupAt) }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-stone-500">Return</dt>
          <dd>{{ formatBusinessDateTime(rental.returnAt) }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-stone-500">Commission</dt>
          <dd>{{ formatMoney(rental.commissionAmount || 0) }}</dd>
        </div>
      </dl>

      <div
        v-if="canRelease"
        class="flex flex-wrap gap-2"
      >
        <UButton
          color="neutral"
          variant="outline"
          :loading="pending"
          @click="cancelBooking"
        >
          Cancel booking
        </UButton>
      </div>
      <p class="text-xs text-stone-500">
        Only the shop can delete a booking. Cancel it to release the dates.
      </p>
    </template>
  </div>
</template>
