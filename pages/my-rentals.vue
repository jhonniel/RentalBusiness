<script setup lang="ts">
import type { RentalListResponse } from '~/types/rental'
import { formatBusinessDate } from '~/utils/datetime'

definePageMeta({
  layout: 'account',
  middleware: 'auth',
})

useSiteMeta({
  title: 'My rentals',
  path: '/my-rentals',
})

const { formatMoney } = useCurrency()
const { data, error, pending } = await useFetch<RentalListResponse>('/api/rentals', {
  query: { pageSize: 20 },
})
const hasData = computed(() => Boolean(data.value))
const remote = useRemoteState(error, pending, hasData)
</script>

<template>
  <section class="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
    <h1 class="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
      My rentals
    </h1>
    <p class="mt-2 max-w-2xl text-stone-600">
      Requests you have submitted. Sign the waiver on an open request before payment.
    </p>

    <CatalogNotice
      v-if="remote.unavailable"
      class="mt-10"
      title="Rentals are not connected"
      description="Add live Supabase credentials to load your requests."
    />

    <CatalogNotice
      v-else-if="remote.failed"
      class="mt-10"
      tone="alert"
      title="Rentals could not load"
      description="Try again in a moment. Your requests will appear here when the list succeeds."
    />

    <div
      v-else-if="remote.loading"
      class="mt-10 space-y-3"
      role="status"
      aria-busy="true"
    >
      <USkeleton class="h-24 w-full" />
      <USkeleton class="h-24 w-full" />
    </div>

    <CatalogNotice
      v-else-if="!data?.items.length"
      class="mt-10"
      title="No rentals yet"
      description="When you book equipment, upcoming and past rentals will appear on this page."
    >
      <UButton to="/products">
        Browse equipment
      </UButton>
    </CatalogNotice>

    <ul
      v-else
      class="mt-10 divide-y divide-stone-100 overflow-hidden rounded-2xl border border-stone-200 bg-white"
    >
      <li
        v-for="rental in data.items"
        :key="rental.uuid"
      >
        <NuxtLink
          :to="`/rentals/${rental.code}`"
          class="flex flex-col gap-3 px-4 py-4 hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between"
        >
          <div class="min-w-0">
            <p class="font-medium text-stone-900">
              {{ rental.items[0]?.product.name || rental.code }}
            </p>
            <p class="mt-1 text-sm break-words text-stone-500">
              {{ rental.code }}
              · {{ formatBusinessDate(rental.startsOn) }} – {{ formatBusinessDate(rental.endsOn) }}
            </p>
            <p class="mt-1 text-sm break-words text-stone-500">
              {{ rental.waiver ? `Waiver ${rental.waiver.version.version}` : 'Waiver unsigned' }}
              · {{ rental.payments[0] ? `Payment ${rental.payments[0].status.replaceAll('_', ' ')}` : 'Unpaid' }}
              <template v-if="rental.receipts[0]">
                · {{ rental.receipts[0].receiptNumber }}
              </template>
            </p>
          </div>
          <div class="flex shrink-0 items-center gap-3">
            <span class="text-sm text-stone-700">{{ formatMoney(rental.totalAmount) }}</span>
            <StatusBadge :status="rental.status" />
          </div>
        </NuxtLink>
      </li>
    </ul>
  </section>
</template>
