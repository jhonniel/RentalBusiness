<script setup lang="ts">
import type { PublicRental, RentalListResponse } from '~/types/rental'
import { BUSINESS_TIMEZONE } from '~/utils/constants'
import { formatBookingDate } from '~/utils/datetime'
import { customerRentalNextLabel, customerRentalNextPath } from '~/utils/rental'
import { productVisual } from '~/utils/storefront'

definePageMeta({
  layout: 'account',
  middleware: ['auth', 'customer-home'],
})

useSiteMeta({
  title: 'Dashboard',
  path: '/dashboard',
})

const { profile } = useAuth()
const { formatMoney } = useCurrency()
const { data, error, pending } = await useFetch<RentalListResponse>('/api/rentals', {
  query: { pageSize: 50 },
})
const hasData = computed(() => Boolean(data.value))
const remote = useRemoteState(error, pending, hasData)

const greeting = computed(() => {
  const hour = Number(new Intl.DateTimeFormat('en-US', {
    timeZone: BUSINESS_TIMEZONE,
    hour: 'numeric',
    hourCycle: 'h23',
  }).format(new Date()))
  const timeOfDay = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const name = profile.value?.firstName?.trim()
  return name ? `${timeOfDay}, ${name}` : timeOfDay
})

const items = computed(() => data.value?.items ?? [])

const counts = computed(() => {
  const rentals = items.value
  return {
    drafts: rentals.filter(item => item.status === 'draft').length,
    upcoming: rentals.filter(item => ['pending', 'awaiting_payment', 'paid', 'approved', 'ready_for_pickup'].includes(item.status)).length,
    active: rentals.filter(item => ['active', 'overdue'].includes(item.status)).length,
    past: rentals.filter(item => ['returned', 'completed', 'cancelled', 'rejected'].includes(item.status)).length,
  }
})

const attention = computed(() => items.value.filter(item => customerRentalNextLabel(item)))
const recent = computed(() => items.value.slice(0, 8))
const upcoming = computed(() =>
  items.value.filter(item =>
    ['pending', 'awaiting_payment', 'paid', 'approved', 'ready_for_pickup'].includes(item.status),
  ).slice(0, 6),
)
const nextRental = computed(() =>
  items.value.find(item =>
    ['paid', 'approved', 'ready_for_pickup', 'active'].includes(item.status),
  ) ?? null,
)

const cards = computed(() => [
  { title: 'To finish', hint: 'Drafts still open', icon: 'i-lucide-list-checks', value: counts.value.drafts },
  { title: 'Upcoming', hint: 'Booked or waiting', icon: 'i-lucide-calendar', value: counts.value.upcoming },
  { title: 'With you', hint: 'Out on a shoot', icon: 'i-lucide-package', value: counts.value.active },
  { title: 'Past', hint: 'Closed requests', icon: 'i-lucide-archive', value: counts.value.past },
])

function cardTo(rental: PublicRental) {
  return customerRentalNextPath(rental)
}

function rentalName(rental: PublicRental) {
  return rental.items[0]?.product.name || rental.code
}

function rentalImage(rental: PublicRental) {
  const slug = rental.items[0]?.product.slug
  return slug ? productVisual(slug) : '/storefront/action-camera.png'
}
</script>

<template>
  <div class="flex flex-1 flex-col">
    <section class="flex flex-1 flex-col px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
      <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <p class="text-sm font-medium text-[#5c6a64]">
            Dashboard
          </p>
          <h1 class="mt-0.5 text-xl font-semibold break-words text-[#12201a] sm:text-2xl">
            {{ greeting }}
          </h1>
        </div>
        <div class="grid grid-cols-2 gap-2 sm:flex">
          <UButton
            to="/products"
            color="neutral"
            class="justify-center rounded-lg bg-[#12201a] text-white hover:bg-[#1b2d26]"
          >
            Browse<span class="hidden sm:inline"> equipment</span>
          </UButton>
          <UButton
            to="/my-rentals"
            color="neutral"
            variant="outline"
            class="justify-center rounded-lg border-[#12201a]/15 text-[#12201a] hover:bg-white"
          >
            All rentals
          </UButton>
        </div>
      </header>

      <CatalogNotice
        v-if="remote.unavailable"
        class="mt-5"
        title="Dashboard is not connected"
        description="Add live Supabase credentials to load rental counts for this account."
      />

      <CatalogNotice
        v-else-if="remote.failed"
        class="mt-5"
        tone="alert"
        title="Dashboard could not load"
        description="Try again in a moment. Your rental counts will appear here when the request succeeds."
      />

      <div
        v-else-if="remote.loading"
        class="mt-5 grid flex-1 gap-4"
        role="status"
        aria-busy="true"
      >
        <USkeleton class="h-24 w-full rounded-2xl" />
        <USkeleton class="min-h-80 w-full flex-1 rounded-2xl" />
      </div>

      <template v-else>
        <div class="account-panel mt-5 grid grid-cols-2 lg:grid-cols-4">
          <article
            v-for="(card, index) in cards"
            :key="card.title"
            class="px-3 py-3 sm:px-4 sm:py-3.5"
            :class="{
              'border-l border-[#12201a]/8': index % 2 === 1,
              'border-t border-[#12201a]/8': index >= 2,
              'lg:border-t-0': index >= 2,
              'lg:border-l': index > 0,
            }"
          >
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-medium text-[#5c6a64]">
                {{ card.title }}
              </p>
              <span class="flex size-7 items-center justify-center rounded-md bg-[#eef1ef] text-[#12201a]">
                <UIcon
                  :name="card.icon"
                  class="size-4"
                />
              </span>
            </div>
            <p class="mt-2 text-2xl font-semibold tabular-nums text-[#12201a]">
              {{ card.value }}
            </p>
            <p class="mt-0.5 line-clamp-1 text-xs text-[#7a8781]">
              {{ card.hint }}
            </p>
          </article>
        </div>

        <div class="mt-4 grid flex-1 items-stretch gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(20rem,0.85fr)]">
          <div class="flex min-h-0 flex-col gap-4">
            <section
              v-if="attention.length"
              class="account-panel"
            >
              <div class="flex items-start justify-between gap-3 border-b border-[#12201a]/8 px-3 py-3 sm:items-center sm:px-4">
                <div class="min-w-0">
                  <h2 class="font-semibold text-[#12201a]">
                    Action required
                  </h2>
                  <p class="mt-0.5 text-sm text-[#5c6a64]">
                    Finish these before the dates can be locked or paid.
                  </p>
                </div>
                <span class="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
                  {{ attention.length }}
                </span>
              </div>
              <ul class="divide-y divide-[#12201a]/8">
                <li
                  v-for="rental in attention"
                  :key="rental.uuid"
                >
                  <AccountRentalCard
                    :rental="rental"
                    :to="cardTo(rental)"
                    action
                  />
                </li>
              </ul>
            </section>

            <section class="account-panel flex min-h-0 flex-col xl:flex-1">
              <div class="flex items-start justify-between gap-3 border-b border-[#12201a]/8 px-3 py-3 sm:items-center sm:px-4">
                <div class="min-w-0">
                  <h2 class="font-semibold text-[#12201a]">
                    Recent rentals
                  </h2>
                  <p class="mt-0.5 text-sm text-[#5c6a64]">
                    Latest requests on this account.
                  </p>
                </div>
                <NuxtLink
                  v-if="items.length"
                  to="/my-rentals"
                  class="shrink-0 text-sm font-medium text-[#12201a] underline-offset-4 hover:underline"
                >
                  View all
                </NuxtLink>
              </div>

              <div
                v-if="!recent.length"
                class="flex flex-1 flex-col items-center justify-center px-5 py-10 text-center"
              >
                <p class="font-semibold text-[#12201a]">
                  No rentals yet
                </p>
                <p class="mx-auto mt-2 max-w-md text-sm leading-6 text-[#5c6a64]">
                  When you book equipment, upcoming and past rentals will appear here.
                </p>
                <UButton
                  to="/products"
                  color="neutral"
                  class="mt-5 bg-[#12201a] text-white hover:bg-[#1b2d26]"
                >
                  Browse equipment
                </UButton>
              </div>

              <ul
                v-else
                class="divide-y divide-[#12201a]/8 xl:min-h-0 xl:flex-1 xl:overflow-auto"
              >
                <li
                  v-for="rental in recent"
                  :key="rental.uuid"
                >
                  <AccountRentalCard
                    :rental="rental"
                    :to="`/rentals/${rental.code}`"
                    amount
                  />
                </li>
              </ul>
            </section>
          </div>

          <aside class="flex min-h-0 flex-col gap-4">
            <section
              v-if="nextRental"
              class="account-panel p-4"
            >
              <p class="text-sm font-medium text-[#5c6a64]">
                Next kit
              </p>
              <div class="mt-3 flex gap-3">
                <div class="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#eef1ef] ring-1 ring-[#12201a]/6">
                  <img
                    :src="rentalImage(nextRental)"
                    :alt="rentalName(nextRental)"
                    class="size-full object-contain p-2"
                  >
                </div>
                <div class="min-w-0 flex-1">
                  <h3 class="truncate font-semibold text-[#12201a]">
                    {{ rentalName(nextRental) }}
                  </h3>
                  <p class="mt-1 truncate text-sm text-[#5c6a64]">
                    {{ nextRental.code }}
                  </p>
                  <p class="mt-1 text-sm text-[#12201a]">
                    {{ formatBookingDate(nextRental.startsOn) }}
                    –
                    {{ formatBookingDate(nextRental.endsOn) }}
                  </p>
                  <div class="mt-2 flex items-center justify-between gap-3">
                    <AccountStatus :status="nextRental.status" />
                    <span class="text-sm font-semibold text-[#12201a]">
                      {{ formatMoney(nextRental.totalAmount) }}
                    </span>
                  </div>
                </div>
              </div>
              <UButton
                :to="`/rentals/${nextRental.code}`"
                color="neutral"
                variant="outline"
                class="mt-3 w-full justify-center border-[#12201a]/15"
              >
                Open rental
              </UButton>
            </section>

            <section
              class="account-panel flex min-h-0 flex-col"
              :class="upcoming.length ? 'flex-1' : ''"
            >
              <div class="border-b border-[#12201a]/8 px-4 py-3">
                <h2 class="font-semibold text-[#12201a]">
                  Upcoming
                </h2>
                <p class="mt-0.5 text-sm text-[#5c6a64]">
                  Booked or waiting on this account.
                </p>
              </div>
              <p
                v-if="!upcoming.length"
                class="px-4 py-5 text-sm text-[#5c6a64]"
              >
                No upcoming rentals yet.
              </p>
              <ul
                v-else
                class="divide-y divide-[#12201a]/8 xl:min-h-0 xl:flex-1 xl:overflow-auto"
              >
                <li
                  v-for="rental in upcoming"
                  :key="rental.uuid"
                >
                  <AccountRentalCard
                    :rental="rental"
                    :to="`/rentals/${rental.code}`"
                    amount
                  />
                </li>
              </ul>
            </section>

            <section class="account-panel hidden p-3 xl:block">
              <div class="grid grid-cols-3 gap-1">
                <NuxtLink
                  to="/products"
                  class="rounded-lg px-2 py-2.5 text-center text-xs font-medium text-[#12201a] hover:bg-[#f7f8f7]"
                >
                  Browse
                </NuxtLink>
                <NuxtLink
                  to="/my-rentals"
                  class="rounded-lg px-2 py-2.5 text-center text-xs font-medium text-[#12201a] hover:bg-[#f7f8f7]"
                >
                  Rentals
                </NuxtLink>
                <NuxtLink
                  to="/profile"
                  class="rounded-lg px-2 py-2.5 text-center text-xs font-medium text-[#12201a] hover:bg-[#f7f8f7]"
                >
                  Profile
                </NuxtLink>
              </div>
            </section>
          </aside>
        </div>
      </template>
    </section>
  </div>
</template>
