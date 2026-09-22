<script setup lang="ts">
import type { PublicRental } from '~/types/rental'
import { formatBusinessDate, formatBusinessDateTime } from '~/utils/datetime'
import { canSubmitRentalRequest } from '~/utils/rental'

definePageMeta({
  layout: 'account',
  middleware: 'auth',
})

const route = useRoute()
const toast = useToast()
const { formatMoney } = useCurrency()
const { authHeaders } = useAuth()
const identifier = computed(() => String(route.params.id))
const cancelling = ref(false)
const submitting = ref(false)

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
const canSubmit = computed(() => rental.value ? canSubmitRentalRequest(rental.value) : false)
const canPay = computed(() =>
  Boolean(rental.value?.waiver)
  && Boolean(rental.value?.identity)
  && rental.value?.status === 'awaiting_payment',
)
const waitingForConfirm = computed(() => rental.value?.status === 'pending')
const canApplyVoucher = computed(() =>
  ['draft', 'pending', 'awaiting_payment'].includes(rental.value?.status ?? ''),
)
const latestPayment = computed(() => rental.value?.payments[0] ?? null)
const latestReceipt = computed(() => rental.value?.receipts[0] ?? null)

async function submitRental() {
  if (!rental.value) {
    return
  }

  submitting.value = true
  try {
    await $fetch(`/api/rentals/${rental.value.uuid}/submit`, {
      method: 'POST',
      headers: authHeaders(),
    })
    toast.add({ title: 'Request submitted. Waiting for the shop to confirm.', color: 'success' })
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    toast.add({
      title: payload?.message || 'We could not submit that request.',
      color: 'error',
    })
  }
  finally {
    submitting.value = false
  }
}

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
  <section class="mx-auto max-w-3xl px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
    <CatalogNotice
      v-if="error?.statusCode === 503"
      title="Rentals are not connected"
      description="Add live Supabase credentials to load this request."
    />

    <div
      v-else-if="rental"
      class="space-y-6"
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

      <CatalogNotice
        v-if="waitingForConfirm"
        title="Waiting for the shop"
        description="Your dates are reserved for 24 hours. If the shop does not confirm this booking in that time, the request is cancelled."
      />

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
                Qty {{ item.quantity }}
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
          <div
            v-if="rental.discountAmount > 0"
            class="flex justify-between"
          >
            <dt class="text-stone-500">
              Voucher{{ rental.voucher ? ` ${rental.voucher.code}` : '' }}
            </dt>
            <dd>−{{ formatMoney(rental.discountAmount) }}</dd>
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

      <AccountRentalVoucherForm
        v-if="canApplyVoucher"
        :rental-uuid="rental.uuid"
        :voucher="rental.voucher"
        :editable="true"
        @applied="refresh()"
      />

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

      <div class="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <UButton
          v-if="canSubmit"
          class="w-full justify-center sm:w-auto"
          :loading="submitting"
          @click="submitRental"
        >
          Submit request
        </UButton>
        <UButton
          v-if="latestReceipt"
          class="w-full justify-center sm:w-auto"
          :to="`/receipts/${latestReceipt.receiptNumber}`"
        >
          View receipt
        </UButton>
        <UButton
          v-if="canPay"
          class="w-full justify-center sm:w-auto"
          :to="`/rentals/${rental.code}/pay`"
        >
          Pay now
        </UButton>
        <UButton
          v-if="canUploadIdentity"
          class="w-full justify-center sm:w-auto"
          :to="`/rentals/${rental.code}/verify`"
        >
          Upload ID
        </UButton>
        <UButton
          v-if="canSignWaiver"
          class="w-full justify-center sm:w-auto"
          :to="`/rentals/${rental.code}/waiver`"
        >
          Sign waiver
        </UButton>
        <UButton
          v-if="canCancel"
          color="error"
          variant="outline"
          class="w-full justify-center sm:w-auto"
          :loading="cancelling"
          @click="cancelRental"
        >
          Cancel request
        </UButton>
        <UButton
          to="/my-rentals"
          color="neutral"
          variant="outline"
          class="w-full justify-center sm:w-auto"
        >
          All rentals
        </UButton>
      </div>
    </div>
  </section>
</template>
