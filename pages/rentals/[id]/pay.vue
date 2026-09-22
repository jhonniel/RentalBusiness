<script setup lang="ts">
import type { PublicPaymentMethod } from '~/types/payment'
import type { PublicRental } from '~/types/rental'

definePageMeta({
  layout: 'account',
  middleware: 'auth',
})

const route = useRoute()
const toast = useToast()
const { formatMoney } = useCurrency()
const { authHeaders } = useAuth()
const identifier = computed(() => String(route.params.id))
const submitting = ref(false)

const { data: rental, error, refresh } = await useFetch<PublicRental>(
  () => `/api/rentals/${identifier.value}`,
)
const { data: paymentMethods } = await useFetch<PublicPaymentMethod[]>('/api/payment-methods')

if (error.value?.statusCode === 404) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Rental not found',
  })
}

useSiteMeta({
  title: rental.value ? `Pay · ${rental.value.code}` : 'Pay',
  path: `/rentals/${identifier.value}/pay`,
})

const latestPayment = computed(() => rental.value?.payments[0] ?? null)
const canSubmit = computed(() =>
  rental.value?.status === 'draft'
  && Boolean(rental.value?.waiver)
  && Boolean(rental.value?.identity),
)
const canPay = computed(() =>
  Boolean(rental.value?.waiver)
  && Boolean(rental.value?.identity)
  && rental.value?.status === 'awaiting_payment',
)
const waitingForConfirm = computed(() => rental.value?.status === 'pending')
const nothingDue = computed(() => Boolean(rental.value && rental.value.totalAmount === 0 && rental.value.voucher))

async function submitRequest() {
  if (!rental.value) {
    return
  }

  submitting.value = true
  try {
    await $fetch(`/api/rentals/${rental.value.uuid}/submit`, {
      method: 'POST',
      headers: authHeaders(),
    })
    toast.add({ title: 'Request submitted', color: 'success' })
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

async function copyValue(value: string, label: string) {
  try {
    await navigator.clipboard.writeText(value)
    toast.add({ title: `${label} copied`, color: 'success' })
  }
  catch {
    toast.add({ title: `Could not copy ${label.toLowerCase()}.`, color: 'error' })
  }
}
</script>

<template>
  <section class="mx-auto max-w-3xl px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
    <h1 class="text-2xl font-semibold tracking-tight break-words text-slate-900 sm:text-3xl">
      Pay for this rental
    </h1>
    <p class="mt-2 text-stone-600">
      Send the amount due to one of the shop accounts below. Use the bank details or QR code uploaded by the operator.
    </p>

    <CatalogNotice
      v-if="error?.statusCode === 503"
      class="mt-8"
      title="Payments are not connected"
      description="Add live Supabase credentials to load this request."
    />

    <CatalogNotice
      v-else-if="rental && !rental.waiver"
      class="mt-8"
      title="Sign the waiver first"
      description="A signed waiver is required before payment."
    >
      <UButton :to="`/rentals/${rental.code}/waiver`">
        Sign waiver
      </UButton>
    </CatalogNotice>

    <CatalogNotice
      v-else-if="rental && !rental.identity"
      class="mt-8"
      title="Upload identity documents first"
      description="A government ID and a selfie holding that ID are required before payment."
    >
      <UButton :to="`/rentals/${rental.code}/verify`">
        Upload ID
      </UButton>
    </CatalogNotice>

    <CatalogNotice
      v-else-if="rental && canSubmit"
      class="mt-8"
      title="Submit this request first"
      description="Send the request to the shop. The bank and QR details appear after that."
    >
      <AccountRentalVoucherForm
        class="mb-4 text-left"
        :rental-uuid="rental.uuid"
        :voucher="rental.voucher"
        :editable="true"
        @applied="refresh()"
      />
      <UButton
        :loading="submitting"
        @click="submitRequest"
      >
        Submit request
      </UButton>
    </CatalogNotice>

    <CatalogNotice
      v-else-if="rental && waitingForConfirm"
      class="mt-8"
      title="Waiting for the shop"
      description="Your dates are reserved for 24 hours. Payment opens after the shop confirms this booking. If they do not, the request is cancelled."
    >
      <UButton :to="`/rentals/${rental.code}`">
        Back to rental
      </UButton>
    </CatalogNotice>

    <CatalogNotice
      v-else-if="rental && rental.status === 'paid'"
      class="mt-8"
      title="This rental is paid"
      description="A receipt is issued when payment is confirmed. Check your email or the rental page."
    >
      <UButton :to="`/rentals/${rental.code}`">
        Back to rental
      </UButton>
    </CatalogNotice>

    <CatalogNotice
      v-else-if="rental && canPay && nothingDue"
      class="mt-8"
      title="Nothing to pay"
      description="The voucher covers this booking. The shop will review and approve it. The deposit hold is unchanged."
    >
      <AccountRentalVoucherForm
        class="mb-4 text-left"
        :rental-uuid="rental.uuid"
        :voucher="rental.voucher"
        :editable="true"
        @applied="refresh()"
      />
      <UButton :to="`/rentals/${rental.code}`">
        Back to rental
      </UButton>
    </CatalogNotice>

    <div
      v-else-if="rental && canPay"
      class="mt-8 space-y-6"
    >
      <section class="rounded-2xl border border-stone-200 bg-white p-5">
        <p class="text-xs uppercase tracking-wider text-lumen-700">
          {{ rental.code }}
        </p>
        <h2 class="mt-2 text-lg font-medium text-stone-900">
          Amount due
        </h2>
        <p class="mt-4 text-3xl text-stone-900">
          {{ formatMoney(rental.totalAmount) }}
        </p>
        <p
          v-if="rental.voucher"
          class="mt-2 text-sm text-stone-600"
        >
          Voucher {{ rental.voucher.code }} saved {{ formatMoney(rental.discountAmount) }}.
        </p>
        <p class="mt-2 text-sm text-stone-500">
          The amount due is the down payment for this booking and is not refundable once booked.
          Deposit {{ formatMoney(rental.depositAmount) }} is a hold and is not charged in this step.
        </p>
        <p
          v-if="latestPayment"
          class="mt-3 text-sm text-stone-600"
        >
          Latest payment: {{ latestPayment.status.replaceAll('_', ' ') }}
        </p>
      </section>

      <AccountRentalVoucherForm
        :rental-uuid="rental.uuid"
        :voucher="rental.voucher"
        :editable="true"
        @applied="refresh()"
      />

      <CatalogNotice
        v-if="!paymentMethods?.length"
        title="No payment method is ready"
        description="The operator has not published a bank account or QR code yet. Check back shortly or contact the shop."
      />

      <section
        v-else
        class="space-y-4"
      >
        <div>
          <h2 class="text-lg font-medium text-stone-900">
            Send payment here
          </h2>
          <p class="mt-1 text-sm text-stone-600">
            Transfer the amount due to a method below, then keep your reference number.
          </p>
        </div>
        <ul class="grid gap-4 sm:grid-cols-2">
          <li
            v-for="method in paymentMethods"
            :key="method.uuid"
            class="rounded-2xl border border-stone-200 bg-white p-5"
          >
            <p class="text-sm font-medium text-stone-900">
              {{ method.name }}
            </p>
            <div
              v-if="method.qrUrl"
              class="mt-4 flex justify-center rounded-xl border border-stone-100 bg-stone-50 p-4"
            >
              <img
                :src="method.qrUrl"
                :alt="`${method.name} QR`"
                class="h-44 w-44 object-contain"
              >
            </div>
            <p
              v-if="method.accountName"
              class="mt-4 text-sm text-stone-700"
            >
              {{ method.accountName }}
            </p>
            <div
              v-if="method.accountNumber"
              class="mt-1 flex items-center justify-between gap-3"
            >
              <p class="text-sm font-medium text-stone-900">
                {{ method.accountNumber }}
              </p>
              <UButton
                color="neutral"
                variant="ghost"
                size="xs"
                @click="copyValue(method.accountNumber!, method.name)"
              >
                Copy
              </UButton>
            </div>
            <p
              v-if="method.instructions"
              class="mt-2 whitespace-pre-wrap text-sm text-stone-600"
            >
              {{ method.instructions }}
            </p>
          </li>
        </ul>
      </section>

      <UButton
        :to="`/rentals/${rental.code}`"
        color="neutral"
        variant="outline"
        class="w-full sm:w-auto"
      >
        Back
      </UButton>
    </div>
  </section>
</template>
