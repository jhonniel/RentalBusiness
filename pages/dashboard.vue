<script setup lang="ts">
import type { PublicRental, RentalListResponse } from '~/types/rental'
import { BUSINESS_TIMEZONE } from '~/utils/constants'
import { customerRentalNextLabel, customerRentalNextPath } from '~/utils/rental'

definePageMeta({
  layout: 'account',
  middleware: ['auth', 'customer-home'],
})

useSiteMeta({
  title: 'Dashboard',
  path: '/dashboard',
})

const { profile } = useAuth()
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
const cards = computed(() => [
  { title: 'To finish', hint: 'Drafts still open', icon: 'i-lucide-list-checks', value: counts.value.drafts },
  { title: 'Upcoming', hint: 'Booked or waiting', icon: 'i-lucide-calendar', value: counts.value.upcoming },
  { title: 'With you', hint: 'Out on a shoot', icon: 'i-lucide-package', value: counts.value.active },
  { title: 'Past', hint: 'Closed requests', icon: 'i-lucide-archive', value: counts.value.past },
])

function cardTo(rental: PublicRental) {
  return customerRentalNextPath(rental)
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
        class="mt-5 space-y-4"
        role="status"
        aria-busy="true"
      >
        <USkeleton class="h-24 w-full rounded-2xl" />
        <USkeleton class="h-48 w-full rounded-2xl" />
        <USkeleton class="h-72 w-full rounded-2xl" />
      </div>

      <div
        v-else
        class="mt-5 flex flex-1 flex-col gap-4"
      >
        <div class="grid shrink-0 grid-cols-2 gap-3 lg:grid-cols-4">
          <article
            v-for="card in cards"
            :key="card.title"
            class="account-panel px-3 py-3 sm:px-4 sm:py-4"
          >
            <div class="flex items-center justify-between gap-3">
              <p class="text-sm font-medium text-[#5c6a64]">
                {{ card.title }}
              </p>
              <span class="flex size-7 shrink-0 items-center justify-center rounded-md bg-[#eef1ef] text-[#12201a]">
                <UIcon
                  :name="card.icon"
                  class="size-4"
                />
              </span>
            </div>
            <p class="mt-2 text-2xl font-semibold tabular-nums text-[#12201a] sm:text-3xl">
              {{ card.value }}
            </p>
            <p class="mt-0.5 text-xs text-[#7a8781]">
              {{ card.hint }}
            </p>
          </article>
        </div>

        <section class="account-panel shrink-0">
          <div class="flex items-start justify-between gap-3 border-b border-[#12201a]/8 px-3 py-3 sm:items-center sm:px-4">
            <div class="min-w-0">
              <h2 class="font-semibold text-[#12201a]">
                Action required
              </h2>
              <p class="mt-0.5 text-sm text-[#5c6a64]">
                Finish these before the dates can be locked or paid.
              </p>
            </div>
            <span
              v-if="attention.length"
              class="rounded-md bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900"
            >
              {{ attention.length }}
            </span>
          </div>
          <p
            v-if="!attention.length"
            class="px-4 py-8 text-sm text-[#5c6a64]"
          >
            Nothing needs your attention right now.
          </p>
          <ul
            v-else
            class="divide-y divide-[#12201a]/8"
          >
            <li
              v-for="rental in attention"
              :key="rental.uuid"
            >
              <AccountRentalCard
                :rental="rental"
                :to="cardTo(rental)"
                action
                amount
              />
            </li>
          </ul>
        </section>

        <section class="account-panel flex min-h-0 flex-1 flex-col">
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
              When you book equipment, your rentals will appear here.
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
            class="divide-y divide-[#12201a]/8"
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
    </section>
  </div>
</template>
