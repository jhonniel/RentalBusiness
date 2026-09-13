<script setup lang="ts">
import type { PublicRental } from '~/types/rental'
import { formatBusinessDate, formatBusinessDateTime } from '~/utils/datetime'

definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const toast = useToast()
const { formatMoney } = useCurrency()
const identifier = computed(() => String(route.params.id))
const cancelling = ref(false)

const { data: rental, error, refresh } = await useFetch<PublicRental>(
  () => `/api/rentals/${identifier.value}`,
)

if (error.value?.statusCode === 404) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Rental not found',
  })
}

useSiteMeta({
  title: rental.value ? `Rental ${rental.value.code}` : 'Rental',
  path: `/rentals/${identifier.value}`,
})

const canCancel = computed(() => ['draft', 'pending', 'awaiting_payment'].includes(rental.value?.status ?? ''))
const canSignWaiver = computed(() => ['draft', 'pending'].includes(rental.value?.status ?? '') && !rental.value?.waiver)
const canUploadIdentity = computed(() =>
  ['draft', 'pending'].includes(rental.value?.status ?? '')
  && Boolean(rental.value?.waiver)
  && !rental.value?.identity,
)
const canPay = computed(() =>
  Boolean(rental.value?.waiver)
  && Boolean(rental.value?.identity)
  && ['pending', 'awaiting_payment'].includes(rental.value?.status ?? ''),
)
const latestPayment = computed(() => rental.value?.payments[0] ?? null)
const latestReceipt = computed(() => rental.value?.receipts[0] ?? null)

async function cancelRental() {
  if (!rental.value) {
    return
  }

  cancelling.value = true
  try {
    await $fetch(`/api/rentals/${rental.value.uuid}/cancel`, { method: 'POST' })
    toast.add({ title: 'Request cancelled', color: 'success' })
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    toast.add({
      title: payload?.message || 'We could not cancel that request.',
      color: 'error',
    })
  }
  finally {
    cancelling.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
    <AccountNav />

    <CatalogNotice
      v-if="error?.statusCode === 503"
      class="mt-8"
      title="Rentals are not connected"
      description="Add live Supabase credentials to load this request."
    />

    <div
      v-else-if="rental"
      class="mt-8 space-y-6"
    >
      <div>
        <p class="text-xs uppercase tracking-wider text-lumen-700">
          {{ rental.code }}
        </p>
        <h1 class="font-display mt-2 text-3xl text-stone-900 sm:text-4xl">
          Rental request
        </h1>
        <div class="mt-3">
          <StatusBadge :status="rental.status" />
        </div>
      </div>

      <section class="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 class="text-sm font-medium text-stone-900">
          Schedule
        </h2>
        <p class="mt-2 text-sm text-stone-600">
          {{ formatBusinessDate(rental.startsOn) }}
          –
          {{ formatBusinessDate(rental.endsOn) }}
        </p>
      </section>

      <section class="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 class="text-sm font-medium text-stone-900">
          Equipment
        </h2>
        <ul class="mt-3 divide-y divide-stone-100">
          <li
            v-for="item in rental.items"
            :key="item.uuid"
            class="flex flex-wrap justify-between gap-3 py-3 text-sm"
          >
            <div class="min-w-0">
              <p class="font-medium text-stone-900">
                {{ item.product.name }}
              </p>
              <p class="text-stone-500">
                {{ item.quantity }} × {{ item.product.sku }}
              </p>
            </div>
            <p>{{ formatMoney(item.lineTotal) }}</p>
          </li>
        </ul>
      </section>

      <section class="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 class="text-sm font-medium text-stone-900">
          Amounts
        </h2>
        <dl class="mt-3 space-y-2 text-sm">
          <div class="flex justify-between">
            <dt class="text-stone-500">
              Subtotal
            </dt>
            <dd>{{ formatMoney(rental.subtotal) }}</dd>
          </div>
          <div class="flex justify-between">
            <dt class="text-stone-500">
              Deposit
            </dt>
            <dd>{{ formatMoney(rental.depositAmount) }}</dd>
          </div>
          <div class="flex justify-between font-medium">
            <dt>Rental total</dt>
            <dd>{{ formatMoney(rental.totalAmount) }}</dd>
          </div>
        </dl>
      </section>

      <section class="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 class="text-sm font-medium text-stone-900">
          Payment
        </h2>
        <p
          v-if="latestPayment"
          class="mt-2 text-sm text-stone-600"
        >
          {{ latestPayment.status.replaceAll('_', ' ') }} · {{ formatMoney(latestPayment.amount) }}
        </p>
        <p
          v-else
          class="mt-2 text-sm text-stone-600"
        >
          No payment has been started.
        </p>
        <p
          v-if="latestReceipt"
          class="mt-2 text-sm text-stone-600"
        >
          Receipt {{ latestReceipt.receiptNumber }}
        </p>
      </section>

      <section class="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 class="text-sm font-medium text-stone-900">
          Waiver
        </h2>
        <p
          v-if="rental.waiver"
          class="mt-2 text-sm text-stone-600"
        >
          Signed by {{ rental.waiver.signerName }} as {{ rental.waiver.version.version }} on {{ formatBusinessDateTime(rental.waiver.acceptedAt) }}.
          <span v-if="rental.waiver.privacyPolicyVersion"> Privacy {{ rental.waiver.privacyPolicyVersion }}.</span>
          <span v-if="rental.waiver.termsVersion"> Terms {{ rental.waiver.termsVersion }}.</span>
        </p>
        <p
          v-else
          class="mt-2 text-sm text-stone-600"
        >
          This request still needs a signed waiver before payment.
        </p>
      </section>

      <section class="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 class="text-sm font-medium text-stone-900">
          Identity documents
        </h2>
        <p
          v-if="rental.identity"
          class="mt-2 text-sm text-stone-600"
        >
          Government ID and selfie with ID were submitted for this rental.
        </p>
        <p
          v-else
          class="mt-2 text-sm text-stone-600"
        >
          Upload a government ID and a selfie holding that ID before payment.
        </p>
      </section>

      <p
        v-if="rental.notes"
        class="text-sm text-stone-600"
      >
        Notes: {{ rental.notes }}
      </p>

      <div class="flex flex-wrap gap-2">
        <UButton
          v-if="latestReceipt"
          :to="`/receipts/${latestReceipt.receiptNumber}`"
        >
          View receipt
        </UButton>
        <UButton
          v-if="canPay"
          :to="`/rentals/${rental.code}/pay`"
        >
          Pay now
        </UButton>
        <UButton
          v-if="canUploadIdentity"
          :to="`/rentals/${rental.code}/verify`"
        >
          Upload ID
        </UButton>
        <UButton
          v-if="canSignWaiver"
          :to="`/rentals/${rental.code}/waiver`"
        >
          Sign waiver
        </UButton>
        <UButton
          v-if="canCancel"
          color="error"
          variant="outline"
          :loading="cancelling"
          @click="cancelRental"
        >
          Cancel request
        </UButton>
        <UButton
          to="/my-rentals"
          color="neutral"
          variant="outline"
        >
          All rentals
        </UButton>
      </div>
    </div>
  </section>
</template>
