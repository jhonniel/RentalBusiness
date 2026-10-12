<script setup lang="ts">
import type { PublicRental } from '~/types/rental'
import { formatBusinessDateTime } from '~/utils/datetime'

definePageMeta({
  layout: 'commissioner',
  middleware: 'commissioner',
})

useSiteMeta({
  title: 'Bookings',
  path: '/commissioner',
})

const { formatMoney } = useCurrency()
const { data, error, pending } = await useFetch<{ items: PublicRental[] }>('/api/commissioner/rentals')

function clientName(rental: PublicRental) {
  if (!rental.customer) {
    return 'Client'
  }
  return `${rental.customer.firstName} ${rental.customer.lastName}`.trim() || 'Client'
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
          Commissioner
        </p>
        <h1 class="mt-2 text-2xl font-medium text-stone-900">
          Bookings
        </h1>
        <p class="mt-1 text-sm text-stone-600">
          Equipment you booked for a client stays on the calendar until you or the shop cancels it. The shop still confirms the booking.
        </p>
      </div>
      <UButton to="/commissioner/bookings/new">
        New booking
      </UButton>
    </div>

    <AdminNotice
      v-if="error"
      title="Bookings are not available"
      description="Sign in again, or ask the shop to finish the commissioner setup."
    />

    <div
      v-else-if="pending && !data"
      class="space-y-3"
    >
      <USkeleton class="h-16 w-full" />
      <USkeleton class="h-16 w-full" />
    </div>

    <AdminNotice
      v-else-if="!data?.items.length"
      title="No bookings yet"
      description="Book equipment for a client. Those dates are held as soon as you save."
    />

    <ul
      v-else
      class="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white"
    >
      <li
        v-for="rental in data.items"
        :key="rental.uuid"
      >
        <NuxtLink
          :to="`/commissioner/bookings/${rental.code}`"
          class="grid gap-3 px-4 py-4 hover:bg-stone-50 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
        >
          <div class="min-w-0">
            <p class="font-medium text-stone-900">
              {{ rental.items[0]?.product.name || rental.code }}
            </p>
            <p class="mt-1 text-sm text-stone-500">
              {{ rental.code }} · {{ clientName(rental) }}
              · {{ formatBusinessDateTime(rental.pickupAt) }} – {{ formatBusinessDateTime(rental.returnAt) }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <p class="text-sm text-stone-700">
              {{ formatMoney(rental.commissionAmount || 0) }}
            </p>
            <StatusBadge :status="rental.status" />
          </div>
        </NuxtLink>
      </li>
    </ul>
  </div>
</template>
