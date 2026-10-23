<script setup lang="ts">
import type { PublicPaymentMethod } from '~/types/payment'
import type { PublicRental } from '~/types/rental'
import { FACEBOOK_MESSENGER_URL } from '~/utils/constants'
import { canCustomerPayRental } from '~/utils/rental'

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
const canPay = computed(() => rental.value ? canCustomerPayRental(rental.value) : false)
const selectedMethodUuid = ref('')
const paymentSent = ref(false)
const selectedMethod = computed(() => (
  paymentMethods.value?.find(method => method.uuid === selectedMethodUuid.value) ?? null
))

watch(paymentMethods, (methods) => {
  if (!selectedMethodUuid.value && methods?.length === 1) {
    selectedMethodUuid.value = methods[0].uuid
  }
}, { immediate: true })

watch(selectedMethodUuid, () => {
  paymentSent.value = false
})
const nothingDue = computed(() => Boolean(
  rental.value
  && rental.value.totalAmount === 0
  && rental.value.depositAmount === 0
  && rental.value.voucher,
))

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
      title="Photograph your ID first"
      description="A government ID and a selfie holding that ID are required before payment."
    >
      <UButton :to="`/rentals/${rental.code}/verify`">
        Take ID photos
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
      description="The voucher covers the rent and there is no deposit to collect. The shop will review and approve it."
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
        <dl class="mt-4 space-y-2 text-sm">
          <div class="flex justify-between gap-4">
            <dt class="text-stone-500">
              Rent
            </dt>
            <dd>{{ formatMoney(rental.totalAmount) }}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-stone-500">
              Deposit
            </dt>
            <dd>{{ formatMoney(rental.depositAmount) }}</dd>
          </div>
        </dl>
        <p class="mt-4 text-3xl text-stone-900">
          {{ formatMoney(rental.totalAmount + rental.depositAmount) }}
        </p>
        <p
          v-if="rental.voucher"
          class="mt-2 text-sm text-stone-600"
        >
          Voucher {{ rental.voucher.code }} saved {{ formatMoney(rental.discountAmount) }}.
        </p>
        <p class="mt-2 text-sm text-stone-500">
          Pay the rent and the deposit together. The rent is not refundable once booked. The shop returns the deposit from the sale after the rental is finished.
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
            Choose how you will pay, then send {{ formatMoney(rental.totalAmount + rental.depositAmount) }} and keep your reference number.
          </p>
          <p
            v-if="rental.status === 'pending'"
            class="mt-1 text-sm text-stone-500"
          >
            The shop still confirms this booking. Your dates are reserved while it is reviewed.
          </p>
        </div>

        <label class="block text-sm">
          <span class="mb-1.5 block font-medium text-stone-700">Payment method</span>
          <select
            v-model="selectedMethodUuid"
            class="h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-sm text-stone-900 focus:border-lumen-700 focus:outline-none"
          >
            <option
              value=""
              disabled
            >
              Choose a payment method
            </option>
            <option
              v-for="method in paymentMethods"
              :key="method.uuid"
              :value="method.uuid"
            >
              {{ method.name }}
            </option>
          </select>
        </label>

        <div
          v-if="selectedMethod"
          class="rounded-2xl border border-stone-200 bg-white p-5"
        >
          <p class="text-sm font-medium text-stone-900">
            {{ selectedMethod.name }}
          </p>
          <div
            v-if="selectedMethod.qrUrl"
            class="mt-4 flex justify-center rounded-xl border border-stone-100 bg-stone-50 p-4"
          >
            <img
              :src="selectedMethod.qrUrl"
              :alt="`${selectedMethod.name} QR`"
              class="aspect-square w-full max-w-56 object-contain"
            >
          </div>
          <p
            v-if="selectedMethod.accountName"
            class="mt-4 text-sm text-stone-700"
          >
            {{ selectedMethod.accountName }}
          </p>
          <div
            v-if="selectedMethod.accountNumber"
            class="mt-1 flex items-center justify-between gap-3"
          >
            <p class="min-w-0 text-sm font-medium break-all text-stone-900">
              {{ selectedMethod.accountNumber }}
            </p>
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              @click="copyValue(selectedMethod.accountNumber!, selectedMethod.name)"
            >
              Copy
            </UButton>
          </div>
          <p
            v-if="selectedMethod.instructions"
            class="mt-2 whitespace-pre-wrap text-sm text-stone-600"
          >
            {{ selectedMethod.instructions }}
          </p>

          <UButton
            v-if="!paymentSent"
            class="mt-5 w-full justify-center sm:w-auto"
            @click="paymentSent = true"
          >
            I've sent the payment
          </UButton>
        </div>

        <div
          v-if="selectedMethod && paymentSent"
          class="rounded-2xl border border-lumen-200 bg-lumen-50 p-5"
          role="status"
        >
          <h3 class="text-base font-medium text-stone-900">
            Send your proof of payment
          </h3>
          <p class="mt-2 text-sm text-stone-700">
            Message a screenshot or photo of your payment to our Facebook page so the shop can confirm it. Include your booking code
            <span class="font-medium text-stone-900">{{ rental.code }}</span>.
          </p>
          <div class="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <UButton
              :to="FACEBOOK_MESSENGER_URL"
              target="_blank"
              rel="noopener"
              icon="i-lucide-facebook"
              class="w-full justify-center sm:w-auto"
            >
              Message us on Facebook
            </UButton>
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-copy"
              class="w-full justify-center sm:w-auto"
              @click="copyValue(rental.code, 'Booking code')"
            >
              Copy booking code
            </UButton>
          </div>
        </div>
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
