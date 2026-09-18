<script setup lang="ts">
import type { PublicRental, RentalListResponse } from '~/types/rental'
import { formatBusinessDate } from '~/utils/datetime'
import { productVisual } from '~/utils/storefront'

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
const items = computed(() => data.value?.items ?? [])

function rentalName(rental: PublicRental) {
  const productName = rental.items[0]?.product.name || rental.code
  const extra = rental.items.length - 1
  return extra > 0 ? `${productName} + ${extra} more` : productName
}

function rentalImage(rental: PublicRental) {
  const slug = rental.items[0]?.product.slug
  return slug ? productVisual(slug) : '/storefront/action-camera.png'
}

function rentalMeta(rental: PublicRental) {
  const waiver = rental.waiver ? `Waiver ${rental.waiver.version.version}` : 'Waiver unsigned'
  const payment = rental.payments[0]
    ? `Payment ${rental.payments[0].status.replaceAll('_', ' ')}`
    : 'Unpaid'
  const receipt = rental.receipts[0]?.receiptNumber
  return receipt ? `${waiver} · ${payment} · ${receipt}` : `${waiver} · ${payment}`
}
</script>

<template>
  <div class="flex min-w-0 flex-1 flex-col">
    <section class="flex min-w-0 flex-1 flex-col px-3 py-4 sm:px-6 sm:py-5 lg:px-8">
      <header class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div class="min-w-0">
          <p class="text-sm font-medium text-[#5c6a64]">
            Account
          </p>
          <h1 class="mt-0.5 text-xl font-semibold break-words text-[#12201a] sm:text-2xl">
            My rentals
          </h1>
          <p class="mt-1 text-sm text-[#5c6a64]">
            Requests you have submitted. Sign the waiver on an open request before payment.
          </p>
        </div>
        <UButton
          to="/products"
          color="neutral"
          class="w-full justify-center rounded-lg bg-[#12201a] text-white hover:bg-[#1b2d26] sm:w-auto"
        >
          Browse equipment
        </UButton>
      </header>

      <CatalogNotice
        v-if="remote.unavailable"
        class="mt-5"
        title="Rentals are not connected"
        description="Add live Supabase credentials to load your requests."
      />

      <CatalogNotice
        v-else-if="remote.failed"
        class="mt-5"
        tone="alert"
        title="Rentals could not load"
        description="Try again in a moment. Your requests will appear here when the list succeeds."
      />

      <div
        v-else-if="remote.loading"
        class="mt-5 space-y-3"
        role="status"
        aria-busy="true"
      >
        <USkeleton class="h-24 w-full rounded-2xl" />
        <USkeleton class="h-24 w-full rounded-2xl" />
        <USkeleton class="h-24 w-full rounded-2xl" />
      </div>

      <CatalogNotice
        v-else-if="!items.length"
        class="mt-5"
        title="No rentals yet"
        description="When you book equipment, upcoming and past rentals will appear on this page."
      >
        <UButton to="/products">
          Browse equipment
        </UButton>
      </CatalogNotice>

      <section
        v-else
        class="account-panel mt-5 w-full min-w-0"
      >
        <ul class="divide-y divide-[#12201a]/8">
          <li
            v-for="rental in items"
            :key="rental.uuid"
          >
            <NuxtLink
              :to="`/rentals/${rental.code}`"
              class="flex flex-col gap-3 p-3 transition-colors hover:bg-[#f7f8f7] sm:flex-row sm:items-center sm:justify-between sm:px-4"
            >
              <div class="flex min-w-0 items-start gap-3 sm:items-center">
                <div class="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#eef1ef] ring-1 ring-[#12201a]/6">
                  <img
                    :src="rentalImage(rental)"
                    :alt="rentalName(rental)"
                    class="size-full object-contain p-2"
                  >
                </div>
                <div class="min-w-0">
                  <p class="font-semibold break-words text-[#12201a]">
                    {{ rentalName(rental) }}
                  </p>
                  <p class="mt-1 text-sm break-words text-[#5c6a64]">
                    {{ rental.code }}
                    · {{ formatBusinessDate(rental.startsOn) }} – {{ formatBusinessDate(rental.endsOn) }}
                  </p>
                  <p class="mt-1 text-sm break-words text-[#5c6a64]">
                    {{ rentalMeta(rental) }}
                  </p>
                </div>
              </div>
              <div class="flex shrink-0 items-center justify-between gap-3 pl-[3.75rem] sm:justify-end sm:pl-0">
                <span class="text-sm font-semibold text-[#12201a]">
                  {{ formatMoney(rental.totalAmount) }}
                </span>
                <AccountStatus :status="rental.status" />
              </div>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </section>
  </div>
</template>
