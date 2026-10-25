<script setup lang="ts">
import type { PublicReceipt } from '~/types/receipt'
import { formatBusinessDate, formatBusinessDateTime } from '~/utils/datetime'
import { rentalPeriodDays } from '~/utils/rental-window'
import { APP_NAME, BUSINESS_ADDRESS, BUSINESS_EMAIL, BUSINESS_PHONE, FACEBOOK_URL } from '~/utils/constants'
import { RECEIPT_58MM_PRINT_CSS, RECEIPT_PURPOSE_LABELS } from '~/utils/receipt'

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
const config = useRuntimeConfig()
const website = computed(() => String(config.public.siteUrl || '').replace(/\/$/, ''))
const websiteLabel = computed(() => website.value.replace(/^https?:\/\//, ''))
const facebookLabel = FACEBOOK_URL.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')
const business = computed(() => {
  const current = receipt.value?.business
  return {
    name: current?.name || snapshot.value?.business.name || APP_NAME,
    address: current?.address || snapshot.value?.business.address || BUSINESS_ADDRESS,
    email: current?.email || snapshot.value?.business.email || BUSINESS_EMAIL,
    phone: current?.phone || BUSINESS_PHONE,
  }
})
const statement = computed(() => receipt.value?.statement ?? null)
const rentalDates = computed(() => ({
  startsOn: receipt.value?.rental?.startsOn || snapshot.value?.rental.startsOn || '',
  endsOn: receipt.value?.rental?.endsOn || snapshot.value?.rental.endsOn || '',
}))
const rentedDays = computed(() => rentalDates.value.startsOn && rentalDates.value.endsOn
  ? rentalPeriodDays(rentalDates.value.startsOn, rentalDates.value.endsOn)
  : 0)
const currentLine = computed(() => statement.value?.lines.find(line => line.current) ?? null)
const purpose = computed(() => snapshot.value?.purpose ?? currentLine.value?.purpose ?? 'booking')
const purposeLabel = computed(() => snapshot.value?.description || currentLine.value?.label || RECEIPT_PURPOSE_LABELS[purpose.value])

useHead({
  style: [{
    key: 'receipt-58mm',
    innerHTML: RECEIPT_58MM_PRINT_CSS,
  }],
})

function printReceipt() {
  window.print()
}
</script>

<template>
  <article class="receipt-paper mx-auto max-w-2xl px-4 py-10 sm:px-6">
    <div class="flex flex-wrap items-center justify-end gap-3 print:hidden">
      <div class="flex flex-wrap gap-2">
        <UButton
          color="neutral"
          variant="outline"
          icon="i-lucide-printer"
          @click="printReceipt"
        >
          Print (58 mm)
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
      <header class="receipt-header flex flex-col items-center border-b border-dashed border-stone-300 pb-5 text-center">
        <img
          src="/logo.png?v=12"
          :alt="business.name"
          width="220"
          height="104"
          class="h-14 w-auto object-contain"
        >
        <p class="mt-2 text-base font-semibold text-stone-900">
          {{ business.name }}
        </p>
        <p class="text-xs text-stone-500">
          {{ business.address }}
        </p>
        <p class="text-xs text-stone-500">
          {{ business.email }}<template v-if="business.phone">
            · {{ business.phone }}
          </template>
        </p>
      </header>

      <div class="mt-5 text-center">
        <h1 class="text-lg font-semibold tracking-wide text-stone-900 uppercase">
          Official receipt
        </h1>
        <p class="mt-0.5 font-mono text-sm text-stone-700">
          {{ receipt.receiptNumber }}
        </p>
        <p class="mt-2 inline-flex items-center gap-1.5 rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700">
          {{ purposeLabel }}
        </p>
        <p class="mt-2 text-sm text-stone-500">
          Issued {{ formatBusinessDate(receipt.issuedAt) }}
        </p>
      </div>

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
            Pickup
          </dt>
          <dd>{{ receipt.rental?.pickupAt ? formatBusinessDateTime(receipt.rental.pickupAt) : formatBusinessDate(rentalDates.startsOn) }}</dd>
        </div>
        <div>
          <dt class="text-stone-500">
            Return
          </dt>
          <dd>{{ receipt.rental?.returnAt ? formatBusinessDateTime(receipt.rental.returnAt) : formatBusinessDate(rentalDates.endsOn) }}</dd>
        </div>
        <div>
          <dt class="text-stone-500">
            Payment
          </dt>
          <dd>{{ snapshot.payment.provider }} · {{ snapshot.payment.paidAt ? formatBusinessDate(snapshot.payment.paidAt) : 'Paid' }}</dd>
        </div>
      </dl>

      <div
        v-if="purpose !== 'booking'"
        class="mt-6 flex justify-between gap-4 border-y border-stone-100 py-3 text-sm"
      >
        <div>
          <p class="font-medium text-stone-900">
            {{ purposeLabel }}
          </p>
          <p class="text-stone-500">
            {{ snapshot.items.map(item => item.name).join(', ') }}
          </p>
        </div>
        <p class="font-medium">
          {{ formatMoney(snapshot.amounts.paidAmount, snapshot.currency) }}
        </p>
      </div>

      <ul
        v-if="purpose === 'booking'"
        class="mt-6 divide-y divide-stone-100 border-y border-stone-100"
      >
        <li
          v-for="item in snapshot.items"
          :key="`${item.name}-${item.quantity}`"
          class="flex justify-between gap-4 py-3 text-sm"
        >
          <div>
            <p class="font-medium text-stone-900">
              {{ item.name }}
            </p>
            <p class="text-stone-500">
              Qty {{ item.quantity }}
            </p>
          </div>
          <p class="text-right tabular-nums">
            {{ formatMoney(item.dailyPrice, snapshot.currency) }} / day × {{ rentedDays }} day{{ rentedDays === 1 ? '' : 's' }}
          </p>
        </li>
      </ul>

      <dl
        v-if="purpose === 'booking' && receipt.discounts && (receipt.discounts.longStay > 0 || receipt.discounts.voucher > 0)"
        class="mt-3 space-y-1.5 text-sm"
      >
        <div
          v-if="receipt.discounts.longStay > 0"
          class="flex justify-between gap-4"
        >
          <dt class="text-stone-600">
            Long-stay discount
          </dt>
          <dd class="tabular-nums text-emerald-700">
            −{{ formatMoney(receipt.discounts.longStay, snapshot.currency) }}
          </dd>
        </div>
        <div
          v-if="receipt.discounts.voucher > 0"
          class="flex justify-between gap-4"
        >
          <dt class="text-stone-600">
            Voucher<template v-if="receipt.discounts.voucherCode">
              {{ receipt.discounts.voucherCode }}
            </template>
          </dt>
          <dd class="tabular-nums text-emerald-700">
            −{{ formatMoney(receipt.discounts.voucher, snapshot.currency) }}
          </dd>
        </div>
      </dl>

      <section
        v-if="statement && statement.lines.length"
        class="mt-8 rounded-xl border border-stone-200 bg-stone-50 p-4"
      >
        <h2 class="text-sm font-semibold text-stone-900">
          Payments on this booking
        </h2>
        <p class="mt-0.5 text-xs text-stone-500">
          Every payment for {{ snapshot.rental.code }}, including extensions and late fees.
        </p>
        <ul class="mt-3 divide-y divide-stone-200 text-sm">
          <li
            v-for="line in statement.lines"
            :key="line.receiptNumber"
            class="flex items-start justify-between gap-4 py-2.5"
          >
            <div class="min-w-0">
              <p class="font-medium text-stone-900">
                {{ line.label }}
              </p>
              <p class="text-xs text-stone-500">
                <NuxtLink
                  v-if="!line.current"
                  :to="`/receipts/${line.receiptNumber}`"
                  class="underline-offset-2 hover:underline print:no-underline"
                >{{ line.receiptNumber }}</NuxtLink>
                <template v-else>
                  {{ line.receiptNumber }}
                </template>
                · {{ formatBusinessDate(line.issuedAt) }}
              </p>
            </div>
            <p class="shrink-0 tabular-nums">
              {{ formatMoney(line.amount, snapshot.currency) }}
            </p>
          </li>
        </ul>
        <div class="mt-2 flex justify-between border-t border-stone-300 pt-3 text-sm font-semibold text-stone-900">
          <span>Total paid</span>
          <span class="tabular-nums">{{ formatMoney(statement.totalPaid, snapshot.currency) }}</span>
        </div>
      </section>
      <footer class="receipt-footer mt-8 border-t border-dashed border-stone-300 pt-5 text-center text-xs text-stone-600">
        <p class="text-sm font-medium text-stone-900">
          Thank you for renting with {{ business.name }}!
        </p>
        <p class="mt-3 flex flex-col items-center gap-1">
          <a
            v-if="website"
            :href="website"
            class="inline-flex items-center gap-1.5 hover:text-stone-900"
          >
            <UIcon
              name="i-lucide-globe"
              class="size-3.5 print:hidden"
            />
            {{ websiteLabel }}
          </a>
          <a
            :href="FACEBOOK_URL"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1.5 hover:text-stone-900"
          >
            <UIcon
              name="i-lucide-facebook"
              class="size-3.5 print:hidden"
            />
            {{ facebookLabel }}
          </a>
          <a
            :href="`mailto:${business.email}`"
            class="inline-flex items-center gap-1.5 hover:text-stone-900"
          >
            <UIcon
              name="i-lucide-mail"
              class="size-3.5 print:hidden"
            />
            {{ business.email }}
          </a>
          <span
            v-if="business.phone"
            class="inline-flex items-center gap-1.5"
          >
            <UIcon
              name="i-lucide-phone"
              class="size-3.5 print:hidden"
            />
            {{ business.phone }}
          </span>
        </p>
        <p class="mt-3 text-[11px] text-stone-400">
          Keep this receipt for your records.
        </p>
        <a
          :href="FACEBOOK_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="receipt-qr mx-auto mt-5 flex w-fit flex-col items-center"
          aria-label="Follow us on Facebook"
        >
          <img
            src="/qr/facebook-jryrentals.svg"
            alt="QR code for the JRY Rentals Facebook page"
            width="128"
            height="128"
            class="size-32"
          >
          <span class="mt-1.5 text-sm font-semibold tracking-wide text-stone-900 uppercase">
            Follow us
          </span>
          <span class="text-[11px] text-stone-500">Scan to visit our Facebook page</span>
        </a>
      </footer>
    </section>
  </article>
</template>
