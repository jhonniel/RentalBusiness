<script setup lang="ts">
import type { PublicRental, RentalListResponse } from '~/types/rental'
import type { CustomerRentalGroup } from '~/utils/rental'
import { formatBookingDateRange, formatBusinessDateTime } from '~/utils/datetime'
import { customerRentalGroup, customerRentalNextLabel, customerRentalNextPath } from '~/utils/rental'
import { productVisual } from '~/utils/storefront'

definePageMeta({
  layout: 'account',
  middleware: ['auth', 'customer-home'],
})

useSiteMeta({
  title: 'My rentals',
  path: '/my-rentals',
})

const { data, error, pending } = await useFetch<RentalListResponse>('/api/rentals', {
  query: { pageSize: 20 },
})
const hasData = computed(() => Boolean(data.value))
const remote = useRemoteState(error, pending, hasData)
const items = computed(() => data.value?.items ?? [])

type Filter = 'all' | CustomerRentalGroup
const filter = ref<Filter>('all')
const counts = computed(() => {
  const total = { all: items.value.length, action: 0, upcoming: 0, past: 0 }
  for (const rental of items.value) {
    total[customerRentalGroup(rental)] += 1
  }
  return total
})
const filters: Array<{ id: Filter, label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'action', label: 'Action needed' },
  { id: 'upcoming', label: 'Upcoming & active' },
  { id: 'past', label: 'Past' },
]
const summary = computed(() => [
  { id: 'action' as const, label: 'Action needed', hint: 'Waiver, ID, or payment to finish', icon: 'i-lucide-circle-alert', tone: 'bg-amber-50 text-amber-700' },
  { id: 'upcoming' as const, label: 'Upcoming & active', hint: 'Waiting, confirmed, or out now', icon: 'i-lucide-calendar-clock', tone: 'bg-sky-50 text-sky-700' },
  { id: 'past' as const, label: 'Past', hint: 'Finished or cancelled', icon: 'i-lucide-history', tone: 'bg-stone-100 text-stone-600' },
])
const visible = computed(() => filter.value === 'all'
  ? items.value
  : items.value.filter(rental => customerRentalGroup(rental) === filter.value))

function rentalName(rental: PublicRental) {
  const productName = rental.items[0]?.product.name || rental.code
  const extra = rental.items.length - 1
  return extra > 0 ? `${productName} + ${extra} more` : productName
}

function rentalImage(rental: PublicRental) {
  const slug = rental.items[0]?.product.slug
  return slug ? productVisual(slug) : '/storefront/action-camera.png'
}

function steps(rental: PublicRental) {
  return [
    { label: 'Waiver', done: Boolean(rental.waiver) },
    { label: 'ID', done: Boolean(rental.identity) },
    { label: 'Paid', done: rental.payments.some(payment => payment.status === 'paid') || ['paid', 'approved', 'ready_for_pickup', 'active', 'overdue', 'returned', 'completed'].includes(rental.status) },
  ]
}
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col">
    <section class="flex min-w-0 flex-1 flex-col px-3 py-4 sm:px-6 sm:py-6 lg:px-8">
      <header class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#5c6a64]">
            Account
          </p>
          <h1 class="mt-1 text-2xl font-semibold tracking-tight break-words text-[#12201a] sm:text-3xl">
            My rentals
          </h1>
          <p class="mt-1 text-sm text-[#5c6a64]">
            Track your bookings and finish any step that is still open.
          </p>
        </div>
        <UButton
          to="/products"
          size="lg"
          icon="i-lucide-plus"
          class="w-full justify-center rounded-full bg-[#12201a] text-white hover:bg-[#1b2d26] sm:w-auto"
        >
          Book equipment
        </UButton>
      </header>

      <CatalogNotice
        v-if="remote.unavailable"
        class="mt-6"
        title="Rentals are not connected"
        description="Add live Supabase credentials to load your requests."
      />

      <CatalogNotice
        v-else-if="remote.failed"
        class="mt-6"
        tone="alert"
        title="Rentals could not load"
        description="Try again in a moment. Your requests will appear here when the list succeeds."
      />

      <div
        v-else-if="remote.loading"
        class="mt-6 space-y-3"
        role="status"
        aria-busy="true"
      >
        <div class="grid gap-3 sm:grid-cols-3">
          <USkeleton
            v-for="index in 3"
            :key="index"
            class="h-20 w-full rounded-2xl"
          />
        </div>
        <USkeleton class="h-28 w-full rounded-2xl" />
        <USkeleton class="h-28 w-full rounded-2xl" />
      </div>

      <div
        v-else-if="!items.length"
        class="account-panel mt-6 flex flex-col items-center px-6 py-14 text-center"
      >
        <span class="flex size-14 items-center justify-center rounded-2xl bg-[#f4f6f5] text-[#12201a]">
          <UIcon
            name="i-lucide-package-open"
            class="size-7"
          />
        </span>
        <h2 class="mt-4 text-lg font-semibold text-[#12201a]">
          No rentals yet
        </h2>
        <p class="mt-1 max-w-sm text-sm text-[#5c6a64]">
          When you book equipment, your upcoming and past rentals will appear here.
        </p>
        <UButton
          to="/products"
          size="lg"
          class="mt-5 rounded-full"
        >
          Browse equipment
        </UButton>
      </div>

      <template v-else>
        <div class="mt-6 grid gap-3 sm:grid-cols-3">
          <button
            v-for="card in summary"
            :key="card.id"
            type="button"
            class="account-panel flex items-center gap-3 p-4 text-left transition-shadow hover:shadow-[0_8px_24px_rgb(18_32_26_/_8%)]"
            :class="filter === card.id ? 'ring-2 ring-[#12201a]' : ''"
            @click="filter = filter === card.id ? 'all' : card.id"
          >
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl"
              :class="card.tone"
            >
              <UIcon
                :name="card.icon"
                class="size-5"
              />
            </span>
            <span class="min-w-0">
              <span class="block text-2xl font-semibold tabular-nums text-[#12201a]">{{ counts[card.id] }}</span>
              <span class="block text-xs font-medium text-[#3b4a44]">{{ card.label }}</span>
              <span class="block truncate text-[11px] text-[#5c6a64]">{{ card.hint }}</span>
            </span>
          </button>
        </div>

        <div
          class="mt-5 flex gap-1 overflow-x-auto rounded-xl border border-[#12201a]/8 bg-white p-1 [scrollbar-width:none] sm:w-fit"
          role="tablist"
          aria-label="Filter rentals"
        >
          <button
            v-for="item in filters"
            :key="item.id"
            type="button"
            role="tab"
            :aria-selected="filter === item.id"
            class="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors"
            :class="filter === item.id ? 'bg-[#12201a] text-white' : 'text-[#3b4a44] hover:bg-[#f4f6f5]'"
            @click="filter = item.id"
          >
            {{ item.label }}
            <span
              class="rounded-full px-1.5 text-xs tabular-nums"
              :class="filter === item.id ? 'bg-white/20' : 'bg-[#f4f6f5] text-[#5c6a64]'"
            >{{ counts[item.id] }}</span>
          </button>
        </div>

        <p
          v-if="!visible.length"
          class="account-panel mt-4 px-4 py-8 text-center text-sm text-[#5c6a64]"
        >
          Nothing here right now.
        </p>

        <ul
          v-else
          class="mt-4 space-y-3"
        >
          <li
            v-for="rental in visible"
            :key="rental.uuid"
            class="account-panel transition-shadow hover:shadow-[0_8px_24px_rgb(18_32_26_/_8%)]"
          >
            <div class="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
              <NuxtLink
                :to="`/rentals/${rental.code}`"
                class="flex min-w-0 flex-1 items-start gap-4"
              >
                <div class="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f4f6f5] ring-1 ring-[#12201a]/6 sm:size-20">
                  <img
                    :src="rentalImage(rental)"
                    :alt="rentalName(rental)"
                    class="size-full object-contain p-2"
                  >
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex flex-wrap items-center gap-2">
                    <p class="font-semibold break-words text-[#12201a]">
                      {{ rentalName(rental) }}
                    </p>
                    <span class="rounded-md bg-[#f4f6f5] px-1.5 py-0.5 font-mono text-[11px] text-[#5c6a64]">{{ rental.code }}</span>
                  </div>
                  <p class="mt-1.5 flex items-center gap-1.5 text-sm text-[#3b4a44]">
                    <UIcon
                      name="i-lucide-calendar"
                      class="size-4 shrink-0 text-[#5c6a64]"
                    />
                    {{ formatBookingDateRange(rental.startsOn, rental.endsOn) }}
                  </p>
                  <p
                    v-if="rental.pickupAt"
                    class="mt-0.5 flex items-center gap-1.5 text-xs text-[#5c6a64]"
                  >
                    <UIcon
                      name="i-lucide-clock"
                      class="size-3.5 shrink-0"
                    />
                    Pickup {{ formatBusinessDateTime(rental.pickupAt) }}
                  </p>
                  <div class="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <AccountStatus :status="rental.status" />
                    <PaymentStatusBadge :rental="rental" />
                    <span
                      v-for="step in steps(rental)"
                      :key="step.label"
                      class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                      :class="step.done ? 'bg-emerald-50 text-emerald-700' : 'bg-[#f4f6f5] text-[#5c6a64]'"
                    >
                      <UIcon
                        :name="step.done ? 'i-lucide-check' : 'i-lucide-circle-dashed'"
                        class="size-3"
                      />
                      {{ step.label }}
                    </span>
                  </div>
                </div>
              </NuxtLink>
              <div class="flex shrink-0 items-center gap-2 sm:flex-col sm:items-end">
                <UButton
                  v-if="customerRentalGroup(rental) === 'action'"
                  :to="customerRentalNextPath(rental)"
                  trailing-icon="i-lucide-arrow-right"
                  class="w-full justify-center rounded-full sm:w-auto"
                >
                  {{ customerRentalNextLabel(rental) }}
                </UButton>
                <UButton
                  :to="`/rentals/${rental.code}`"
                  color="neutral"
                  variant="ghost"
                  trailing-icon="i-lucide-chevron-right"
                  class="w-full justify-center rounded-full sm:w-auto"
                >
                  View details
                </UButton>
              </div>
            </div>
          </li>
        </ul>
      </template>
    </section>
  </div>
</template>
