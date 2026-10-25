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
const qrOpen = ref(false)
const selectedMethod = computed(() => (
  paymentMethods.value?.find(method => method.uuid === selectedMethodUuid.value) ?? null
))

watch(paymentMethods, (methods) => {
  if (selectedMethodUuid.value || !methods?.length) {
    return
  }
  const preferred = methods.find(method => method.sortOrder === 1) ?? methods[0]
  selectedMethodUuid.value = preferred?.uuid ?? ''
}, { immediate: true })

watch(selectedMethodUuid, () => {
  paymentSent.value = false
  qrOpen.value = false
})
const currentStep = computed(() => {
  if (!rental.value?.waiver) {
    return 1
  }
  if (!rental.value.identity) {
    return 2
  }
  return canSubmit.value ? 3 : 4
})
const amountDue = computed(() => rental.value ? rental.value.totalAmount + rental.value.depositAmount : 0)
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
  <section class="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
    <div class="flex flex-col gap-6 border-b border-[#12201a]/8 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div class="min-w-0">
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#5b6b64]">
          <template v-if="rental">
            {{ rental.code }}
          </template>
          <template v-else>
            Booking
          </template>
        </p>
        <h1 class="mt-2 text-2xl font-semibold tracking-tight break-words text-[#12201a] sm:text-3xl">
          Pay for this rental
        </h1>
        <p class="mt-2 max-w-xl text-sm leading-6 text-[#5b6b64]">
          Send the amount due to one of the shop accounts below, then message us your proof of payment.
        </p>
      </div>
      <BookingSteps
        :current="currentStep"
        class="lg:min-w-[26rem]"
      />
    </div>

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
      <RentalVoucherForm
        class="mx-auto mb-4 w-full max-w-md"
        centered
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
      <RentalVoucherForm
        class="mx-auto mb-4 w-full max-w-md"
        centered
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
      class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"
    >
      <div class="min-w-0 space-y-6">
        <div
          v-if="rental.status === 'pending'"
          class="flex items-start gap-3 rounded-2xl border border-[#12201a]/8 bg-[#f4f6f5] p-4 text-sm text-[#3b4a44]"
        >
          <UIcon
            name="i-lucide-calendar-check"
            class="mt-0.5 size-5 shrink-0 text-[#12201a]"
          />
          <p>
            <span class="font-medium text-[#12201a]">Your dates are reserved.</span>
            The shop still confirms this booking while it is reviewed.
          </p>
        </div>

        <CatalogNotice
          v-if="!paymentMethods?.length"
          title="No payment method is ready"
          description="The operator has not published a bank account or QR code yet. Check back shortly or contact the shop."
        />

        <template v-else>
          <section class="storefront-card rounded-2xl p-5 sm:p-6">
            <div class="flex items-start gap-3">
              <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#12201a] text-xs font-semibold text-white">1</span>
              <div class="min-w-0">
                <h2 class="font-semibold text-[#12201a]">
                  Choose how to pay
                </h2>
                <p class="mt-0.5 text-sm text-[#5b6b64]">
                  Send {{ formatMoney(amountDue) }} and keep your reference number.
                </p>
              </div>
            </div>

            <div
              class="mt-5 grid gap-3 sm:grid-cols-2"
              role="radiogroup"
              aria-label="Payment method"
            >
              <button
                v-for="method in paymentMethods"
                :key="method.uuid"
                type="button"
                role="radio"
                :aria-checked="selectedMethodUuid === method.uuid"
                class="flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors"
                :class="selectedMethodUuid === method.uuid
                  ? 'border-[#12201a] bg-[#f4f6f5] ring-1 ring-[#12201a]'
                  : 'border-[#12201a]/12 hover:border-[#12201a]/30'"
                @click="selectedMethodUuid = method.uuid"
              >
                <span
                  v-if="method.logoUrl"
                  class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#12201a]/10 bg-white p-1"
                >
                  <img
                    :src="method.logoUrl"
                    :alt="`${method.name} logo`"
                    class="size-full object-contain"
                  >
                </span>
                <span
                  v-else
                  class="flex size-10 shrink-0 items-center justify-center rounded-lg"
                  :class="selectedMethodUuid === method.uuid ? 'bg-[#12201a] text-white' : 'bg-[#f4f6f5] text-[#3b4a44]'"
                >
                  <UIcon
                    :name="method.qrUrl ? 'i-lucide-qr-code' : 'i-lucide-landmark'"
                    class="size-4.5"
                  />
                </span>
                <span class="min-w-0 flex-1">
                  <span class="block truncate text-sm font-medium text-[#12201a]">{{ method.name }}</span>
                  <span class="block truncate text-xs text-[#5b6b64]">
                    {{ method.qrUrl && method.accountNumber ? 'QR code or account number' : method.qrUrl ? 'Scan the QR code' : 'Send to the account number' }}
                  </span>
                </span>
                <UIcon
                  v-if="selectedMethodUuid === method.uuid"
                  name="i-lucide-circle-check"
                  class="size-5 shrink-0 text-[#12201a]"
                />
              </button>
            </div>

            <div
              v-if="selectedMethod"
              class="mt-5 rounded-2xl border border-[#12201a]/10 bg-[#fbfcfb] p-5"
            >
              <div
                class="grid gap-5"
                :class="selectedMethod.qrUrl ? 'sm:grid-cols-[12rem_minmax(0,1fr)] sm:items-start' : ''"
              >
                <div
                  v-if="selectedMethod.qrUrl"
                  class="flex flex-col items-center gap-2"
                >
                  <button
                    type="button"
                    class="group relative rounded-xl border border-[#12201a]/10 bg-white p-3 transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#12201a]"
                    :aria-label="`Enlarge ${selectedMethod.name} QR code`"
                    @click="qrOpen = true"
                  >
                    <img
                      :src="selectedMethod.qrUrl"
                      :alt="`${selectedMethod.name} QR`"
                      class="aspect-square w-full max-w-44 object-contain"
                    >
                    <span class="absolute right-2 bottom-2 flex size-7 items-center justify-center rounded-full bg-[#12201a] text-white shadow-sm transition-transform group-hover:scale-110">
                      <UIcon
                        name="i-lucide-maximize-2"
                        class="size-3.5"
                      />
                    </span>
                  </button>
                  <p class="text-xs text-[#5b6b64]">
                    Tap to enlarge · scan with your banking app
                  </p>
                </div>
                <dl class="min-w-0 space-y-3 text-sm">
                  <div>
                    <dt class="text-xs text-[#5b6b64]">
                      Pay with
                    </dt>
                    <dd class="mt-1 flex items-center gap-2 font-medium text-[#12201a]">
                      <img
                        v-if="selectedMethod.logoUrl"
                        :src="selectedMethod.logoUrl"
                        :alt="`${selectedMethod.name} logo`"
                        class="size-7 rounded-md border border-[#12201a]/10 bg-white object-contain p-0.5"
                      >
                      {{ selectedMethod.name }}
                    </dd>
                  </div>
                  <div v-if="selectedMethod.accountName">
                    <dt class="text-xs text-[#5b6b64]">
                      Account name
                    </dt>
                    <dd class="mt-0.5 font-medium break-words text-[#12201a]">
                      {{ selectedMethod.accountName }}
                    </dd>
                  </div>
                  <div v-if="selectedMethod.accountNumber">
                    <dt class="text-xs text-[#5b6b64]">
                      Account number
                    </dt>
                    <dd class="mt-1 flex items-center justify-between gap-3 rounded-lg border border-[#12201a]/10 bg-white px-3 py-2">
                      <span class="min-w-0 font-mono text-base font-medium tracking-wide break-all text-[#12201a]">{{ selectedMethod.accountNumber }}</span>
                      <UButton
                        color="neutral"
                        variant="soft"
                        size="xs"
                        icon="i-lucide-copy"
                        @click="copyValue(selectedMethod.accountNumber!, selectedMethod.name)"
                      >
                        Copy
                      </UButton>
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-[#5b6b64]">
                      Amount to send
                    </dt>
                    <dd class="mt-0.5 text-lg font-semibold tabular-nums text-[#12201a]">
                      {{ formatMoney(amountDue) }}
                    </dd>
                  </div>
                  <p
                    v-if="selectedMethod.instructions"
                    class="whitespace-pre-wrap rounded-lg bg-[#f4f6f5] px-3 py-2 text-[#3b4a44]"
                  >
                    {{ selectedMethod.instructions }}
                  </p>
                </dl>
              </div>

              <UButton
                v-if="!paymentSent"
                size="lg"
                icon="i-lucide-send"
                class="mt-5 w-full justify-center rounded-full sm:w-auto"
                @click="paymentSent = true"
              >
                I've sent the payment
              </UButton>
            </div>
            <p
              v-else
              class="mt-5 rounded-xl bg-[#f4f6f5] px-3 py-2 text-sm text-[#5b6b64]"
            >
              Choose a payment method to see the account details.
            </p>
          </section>

          <section
            v-if="selectedMethod && paymentSent"
            class="storefront-card rounded-2xl border-l-4 border-l-[#1877f2] p-5 sm:p-6"
            role="status"
          >
            <div class="flex items-start gap-3">
              <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#12201a] text-xs font-semibold text-white">2</span>
              <div class="min-w-0">
                <h2 class="font-semibold text-[#12201a]">
                  Send your proof of payment
                </h2>
                <p class="mt-1 text-sm leading-6 text-[#3b4a44]">
                  Message a screenshot or photo of your payment to our Facebook page so the shop can confirm it. Include your booking code
                  <span class="font-semibold text-[#12201a]">{{ rental.code }}</span>.
                </p>
              </div>
            </div>
            <div class="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <UButton
                :to="FACEBOOK_MESSENGER_URL"
                target="_blank"
                rel="noopener"
                size="lg"
                icon="i-lucide-facebook"
                class="w-full justify-center rounded-full bg-[#1877f2] hover:bg-[#166fe5] sm:w-auto"
              >
                Message us on Facebook
              </UButton>
              <UButton
                color="neutral"
                variant="outline"
                size="lg"
                icon="i-lucide-copy"
                class="w-full justify-center rounded-full sm:w-auto"
                @click="copyValue(rental.code, 'Booking code')"
              >
                Copy booking code
              </UButton>
            </div>
          </section>
        </template>
      </div>

      <aside class="space-y-4 lg:sticky lg:top-24">
        <section class="storefront-card overflow-hidden rounded-2xl">
          <div class="border-b border-[#12201a]/8 p-5">
            <p class="text-xs text-[#5b6b64]">
              Amount due
            </p>
            <p class="mt-1 text-3xl font-semibold tabular-nums text-[#12201a]">
              {{ formatMoney(amountDue) }}
            </p>
            <p
              v-for="item in rental.items"
              :key="item.uuid"
              class="mt-2 truncate text-sm text-[#3b4a44]"
            >
              {{ item.product.name }} · Qty {{ item.quantity }}
            </p>
          </div>
          <div class="space-y-4 p-5">
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between gap-4">
                <dt class="text-[#5b6b64]">
                  Rent
                </dt>
                <dd class="tabular-nums text-[#12201a]">
                  {{ formatMoney(rental.voucher ? rental.totalAmount + rental.discountAmount : rental.totalAmount) }}
                </dd>
              </div>
              <div
                v-if="rental.voucher"
                class="flex justify-between gap-4"
              >
                <dt class="text-[#5b6b64]">
                  Voucher {{ rental.voucher.code }}
                </dt>
                <dd class="tabular-nums text-emerald-700">
                  −{{ formatMoney(rental.discountAmount) }}
                </dd>
              </div>
              <div class="flex justify-between gap-4">
                <dt class="text-[#5b6b64]">
                  Refundable deposit
                </dt>
                <dd class="tabular-nums text-[#12201a]">
                  {{ formatMoney(rental.depositAmount) }}
                </dd>
              </div>
              <div class="flex justify-between gap-4 border-t border-[#12201a]/8 pt-2 font-semibold text-[#12201a]">
                <dt>Total</dt>
                <dd class="tabular-nums">
                  {{ formatMoney(amountDue) }}
                </dd>
              </div>
            </dl>
            <ul class="space-y-1.5 text-xs leading-5 text-[#5b6b64]">
              <li class="flex items-start gap-2">
                <UIcon
                  name="i-lucide-info"
                  class="mt-0.5 size-3.5 shrink-0"
                />
                Pay the rent and the deposit together.
              </li>
              <li class="flex items-start gap-2">
                <UIcon
                  name="i-lucide-info"
                  class="mt-0.5 size-3.5 shrink-0"
                />
                The rent is not refundable once booked.
              </li>
              <li class="flex items-start gap-2">
                <UIcon
                  name="i-lucide-info"
                  class="mt-0.5 size-3.5 shrink-0"
                />
                The shop returns the deposit after the rental is finished.
              </li>
            </ul>
            <p
              v-if="latestPayment"
              class="flex items-center justify-between gap-3 rounded-xl bg-[#f4f6f5] px-3 py-2 text-sm"
            >
              <span class="text-[#5b6b64]">Latest payment</span>
              <span class="font-medium capitalize text-[#12201a]">{{ latestPayment.status.replaceAll('_', ' ') }}</span>
            </p>
          </div>
        </section>

        <RentalVoucherForm
          :rental-uuid="rental.uuid"
          :voucher="rental.voucher"
          :editable="true"
          @applied="refresh()"
        />

        <UButton
          :to="`/rentals/${rental.code}`"
          color="neutral"
          variant="ghost"
          icon="i-lucide-arrow-left"
          class="w-full justify-center rounded-full"
        >
          Back to rental
        </UButton>
      </aside>

      <UModal
        v-if="selectedMethod?.qrUrl"
        v-model:open="qrOpen"
        :title="selectedMethod.name"
        description="Scan this QR code with your banking or e-wallet app."
        :ui="{ content: 'sm:max-w-md' }"
      >
        <template #body>
          <div class="flex flex-col items-center gap-4">
            <img
              v-if="selectedMethod.logoUrl"
              :src="selectedMethod.logoUrl"
              :alt="`${selectedMethod.name} logo`"
              class="h-10 w-auto max-w-40 object-contain"
            >
            <div class="w-full rounded-2xl border border-[#12201a]/10 bg-white p-4">
              <img
                :src="selectedMethod.qrUrl"
                :alt="`${selectedMethod.name} QR`"
                class="mx-auto aspect-square w-full max-w-80 object-contain"
              >
            </div>
            <dl class="w-full space-y-2 text-sm">
              <div
                v-if="selectedMethod.accountName"
                class="flex justify-between gap-4"
              >
                <dt class="text-[#5b6b64]">
                  Account name
                </dt>
                <dd class="text-right font-medium break-words text-[#12201a]">
                  {{ selectedMethod.accountName }}
                </dd>
              </div>
              <div
                v-if="selectedMethod.accountNumber"
                class="flex items-center justify-between gap-4"
              >
                <dt class="text-[#5b6b64]">
                  Account number
                </dt>
                <dd class="flex items-center gap-2 font-mono font-medium text-[#12201a]">
                  <span class="break-all">{{ selectedMethod.accountNumber }}</span>
                  <UButton
                    color="neutral"
                    variant="soft"
                    size="xs"
                    icon="i-lucide-copy"
                    :aria-label="`Copy ${selectedMethod.name} account number`"
                    @click="copyValue(selectedMethod.accountNumber!, selectedMethod.name)"
                  />
                </dd>
              </div>
              <div class="flex justify-between gap-4 border-t border-[#12201a]/8 pt-2">
                <dt class="font-medium text-[#12201a]">
                  Amount to send
                </dt>
                <dd class="text-lg font-semibold tabular-nums text-[#12201a]">
                  {{ formatMoney(amountDue) }}
                </dd>
              </div>
            </dl>
            <div class="flex w-full flex-col gap-2 sm:flex-row">
              <UButton
                :to="selectedMethod.qrUrl"
                target="_blank"
                rel="noopener"
                download
                color="neutral"
                variant="outline"
                icon="i-lucide-download"
                class="w-full justify-center rounded-full"
              >
                Save QR image
              </UButton>
              <UButton
                color="neutral"
                class="w-full justify-center rounded-full"
                @click="qrOpen = false"
              >
                Done
              </UButton>
            </div>
          </div>
        </template>
      </UModal>
    </div>
  </section>
</template>
