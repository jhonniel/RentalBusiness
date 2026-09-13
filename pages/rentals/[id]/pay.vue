<script setup lang="ts">
import type { PaymentCheckout, PublicPaymentMethod } from '~/types/payment'
import type { PublicRental } from '~/types/rental'

definePageMeta({
  middleware: 'auth',
})

const route = useRoute()
const { formatMoney } = useCurrency()
const identifier = computed(() => String(route.params.id))
const pending = ref(false)
const formError = ref('')

const { data: rental, error } = await useFetch<PublicRental>(
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
const canPay = computed(() =>
  Boolean(rental.value?.waiver)
  && Boolean(rental.value?.identity)
  && ['pending', 'awaiting_payment'].includes(rental.value?.status ?? ''),
)

async function startCheckout() {
  if (!rental.value) {
    return
  }

  formError.value = ''
  pending.value = true
  try {
    const checkout = await $fetch<PaymentCheckout>('/api/payments/create', {
      method: 'POST',
      body: {
        rentalUuid: rental.value.uuid,
        rentalCode: rental.value.code,
      },
    })
    await navigateTo(checkout.checkoutUrl, { external: checkout.checkoutUrl.startsWith('http') })
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not start that payment.'
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-3xl px-4 py-10 sm:px-6 lg:px-8">
    <AccountNav />

    <h1 class="mt-8 text-2xl font-semibold tracking-tight break-words text-slate-900 sm:text-3xl">
      Pay for this rental
    </h1>
    <p class="mt-2 text-stone-600">
      The amount is taken from the server quote. Payment status is confirmed by the provider, not by this page.
    </p>

    <CatalogNotice
      v-if="error?.statusCode === 503"
      class="mt-8"
      title="Payments are not connected"
      description="Add live Supabase credentials and a service-role key to start checkout."
    />

    <CatalogNotice
      v-else-if="rental && !rental.waiver"
      class="mt-8"
      title="Sign the waiver first"
      description="A signed waiver is required before checkout."
    >
      <UButton :to="`/rentals/${rental.code}/waiver`">
        Sign waiver
      </UButton>
    </CatalogNotice>

    <CatalogNotice
      v-else-if="rental && !rental.identity"
      class="mt-8"
      title="Upload identity documents first"
      description="A government ID and a selfie holding that ID are required before checkout."
    >
      <UButton :to="`/rentals/${rental.code}/verify`">
        Upload ID
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

    <div
      v-else-if="rental && canPay"
      class="mt-8 space-y-6"
    >
      <AuthAlert
        v-if="formError"
        :description="formError"
      />

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
        <p class="mt-2 text-sm text-stone-500">
          Deposit {{ formatMoney(rental.depositAmount) }} is a hold and is not charged in this step.
        </p>
        <p
          v-if="latestPayment"
          class="mt-3 text-sm text-stone-600"
        >
          Latest payment: {{ latestPayment.status.replaceAll('_', ' ') }}
        </p>
      </section>

      <section
        v-if="paymentMethods?.length"
        class="space-y-4"
      >
        <div>
          <h2 class="text-lg font-medium text-stone-900">
            Pay with QR
          </h2>
          <p class="mt-1 text-sm text-stone-600">
            Scan a method below, send the amount due, then keep your reference number.
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
            <p
              v-if="method.accountNumber"
              class="text-sm text-stone-900"
            >
              {{ method.accountNumber }}
            </p>
            <p
              v-if="method.instructions"
              class="mt-2 whitespace-pre-wrap text-sm text-stone-600"
            >
              {{ method.instructions }}
            </p>
          </li>
        </ul>
      </section>

      <div class="flex flex-wrap gap-2">
        <UButton
          class="w-full sm:w-auto"
          :loading="pending"
          @click="startCheckout"
        >
          Continue to payment
        </UButton>
        <UButton
          :to="`/rentals/${rental.code}`"
          color="neutral"
          variant="outline"
          class="w-full sm:w-auto"
        >
          Back
        </UButton>
      </div>
    </div>
  </section>
</template>
