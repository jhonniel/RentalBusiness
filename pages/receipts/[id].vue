<script setup lang="ts">
import type { PublicReceipt } from '~/types/receipt'
import { formatBusinessDate } from '~/utils/datetime'

definePageMeta({
  layout: 'blank',
  middleware: 'auth',
})

const route = useRoute()
const { formatMoney } = useCurrency()
const identifier = computed(() => String(route.params.id))

const { data: receipt, error } = await useFetch<PublicReceipt>(
  () => `/api/receipts/${identifier.value}`,
)

if (error.value?.statusCode === 404) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Receipt not found',
  })
}

useSiteMeta({
  title: receipt.value ? `Receipt ${receipt.value.receiptNumber}` : 'Receipt',
  path: `/receipts/${identifier.value}`,
})

const snapshot = computed(() => receipt.value?.snapshot)

function printReceipt() {
  window.print()
}
</script>

<template>
  <article class="mx-auto max-w-2xl px-4 py-10 sm:px-6">
    <div class="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <AppLogo />
      <div class="flex flex-wrap gap-2">
        <UButton
          color="neutral"
          variant="outline"
          @click="printReceipt"
        >
          Print
        </UButton>
        <UButton
          v-if="snapshot"
          :to="`/rentals/${snapshot.rental.code}`"
          color="neutral"
          variant="ghost"
        >
          Back
        </UButton>
      </div>
    </div>

    <CatalogNotice
      v-if="error?.statusCode === 503"
      class="mt-8"
      title="Receipts are not connected"
      description="Add live Supabase credentials to load this receipt."
    />

    <section
      v-else-if="receipt && snapshot"
      class="mt-8 rounded-2xl border border-stone-200 bg-white p-6"
    >
      <p class="text-xs uppercase tracking-wider text-lumen-700">
        {{ snapshot.business.name }}
      </p>
      <h1 class="font-display mt-2 text-3xl break-words text-stone-900 sm:text-4xl">
        Receipt {{ receipt.receiptNumber }}
      </h1>
      <p class="mt-2 text-sm text-stone-500">
        Issued {{ formatBusinessDate(receipt.issuedAt) }}
      </p>
      <p
        v-if="snapshot.business.address"
        class="mt-1 text-sm text-stone-500"
      >
        {{ snapshot.business.address }}
      </p>

      <dl class="mt-6 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt class="text-stone-500">
            Rental
          </dt>
          <dd class="font-medium text-stone-900">
            {{ snapshot.rental.code }}
          </dd>
        </div>
        <div>
          <dt class="text-stone-500">
            Customer
          </dt>
          <dd class="font-medium text-stone-900">
            {{ snapshot.customer.name }}
          </dd>
        </div>
        <div>
          <dt class="text-stone-500">
            Dates
          </dt>
          <dd>{{ formatBusinessDate(snapshot.rental.startsOn) }} – {{ formatBusinessDate(snapshot.rental.endsOn) }}</dd>
        </div>
        <div>
          <dt class="text-stone-500">
            Payment
          </dt>
          <dd>{{ snapshot.payment.provider }} · {{ snapshot.payment.paidAt ? formatBusinessDate(snapshot.payment.paidAt) : 'Paid' }}</dd>
        </div>
      </dl>

      <ul class="mt-6 divide-y divide-stone-100 border-y border-stone-100">
        <li
          v-for="item in snapshot.items"
          :key="item.sku"
          class="flex justify-between gap-4 py-3 text-sm"
        >
          <div>
            <p class="font-medium text-stone-900">
              {{ item.name }}
            </p>
            <p class="text-stone-500">
              {{ item.quantity }} × {{ item.sku }}
            </p>
          </div>
          <p>{{ formatMoney(item.lineTotal, snapshot.currency) }}</p>
        </li>
      </ul>

      <dl class="mt-4 space-y-2 text-sm">
        <div class="flex justify-between">
          <dt class="text-stone-500">
            Subtotal
          </dt>
          <dd>{{ formatMoney(snapshot.amounts.subtotal, snapshot.currency) }}</dd>
        </div>
        <div class="flex justify-between">
          <dt class="text-stone-500">
            Deposit hold
          </dt>
          <dd>{{ formatMoney(snapshot.amounts.depositAmount, snapshot.currency) }}</dd>
        </div>
        <div class="flex justify-between font-medium">
          <dt>Amount paid</dt>
          <dd>{{ formatMoney(snapshot.amounts.paidAmount, snapshot.currency) }}</dd>
        </div>
      </dl>
    </section>
  </article>
</template>
