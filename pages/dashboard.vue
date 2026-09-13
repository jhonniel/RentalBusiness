<script setup lang="ts">
import type { RentalListResponse } from '~/types/rental'

definePageMeta({
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
  const name = profile.value?.firstName?.trim()
  return name ? `Welcome back, ${name}` : 'Welcome back'
})

const counts = computed(() => {
  const items = data.value?.items ?? []
  return {
    upcoming: items.filter(item => ['pending', 'awaiting_payment', 'paid', 'approved', 'ready_for_pickup'].includes(item.status)).length,
    active: items.filter(item => ['active', 'overdue'].includes(item.status)).length,
    past: items.filter(item => ['returned', 'completed', 'cancelled', 'rejected'].includes(item.status)).length,
  }
})
</script>

<template>
  <section class="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
    <AccountNav />

    <h1 class="mt-8 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
      {{ greeting }}
    </h1>
    <p class="mt-2 max-w-2xl text-sm text-slate-500">
      Upcoming, active, and past rentals for this account.
    </p>

    <CatalogNotice
      v-if="remote.unavailable"
      class="mt-10"
      title="Dashboard is not connected"
      description="Add live Supabase credentials to load rental counts for this account."
    />

    <CatalogNotice
      v-else-if="remote.failed"
      class="mt-10"
      tone="alert"
      title="Dashboard could not load"
      description="Try again in a moment. Your rental counts will appear here when the request succeeds."
    />

    <div
      v-else-if="remote.loading"
      class="mt-10 grid gap-4 md:grid-cols-3"
      role="status"
      aria-busy="true"
    >
      <USkeleton
        v-for="index in 3"
        :key="index"
        class="h-36 w-full"
      />
    </div>

    <div
      v-else
      class="mt-10 grid gap-4 md:grid-cols-3"
    >
      <article
        v-for="card in [
          { title: 'Upcoming', copy: 'Requests that are waiting or confirmed.', value: counts.upcoming },
          { title: 'Active', copy: 'Equipment that is currently with you.', value: counts.active },
          { title: 'Past', copy: 'Completed and cancelled rentals.', value: counts.past },
        ]"
        :key="card.title"
        class="saas-card rounded-2xl p-5"
      >
        <h2 class="text-sm font-medium text-stone-900">
          {{ card.title }}
        </h2>
        <p class="mt-3 text-3xl text-stone-900">
          {{ card.value }}
        </p>
        <p class="mt-2 text-sm text-stone-600">
          {{ card.copy }}
        </p>
      </article>
    </div>

    <div class="mt-8">
      <UButton to="/my-rentals">
        View rentals
      </UButton>
    </div>
  </section>
</template>
