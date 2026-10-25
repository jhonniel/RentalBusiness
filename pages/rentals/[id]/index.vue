<script setup lang="ts">
import type { PublicRental } from '~/types/rental'
import { formatBookingDateRange, formatBusinessDateTime } from '~/utils/datetime'
import { canCustomerPayRental, canSubmitRentalRequest, customerRentalNextLabel, customerRentalNextPath } from '~/utils/rental'
import { productVisual } from '~/utils/storefront'
import { FACEBOOK_MESSENGER_URL } from '~/utils/constants'

definePageMeta({
  layout: 'account',
  middleware: 'auth',
})

const route = useRoute()
const toast = useToast()
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
const canPay = computed(() => rental.value ? canCustomerPayRental(rental.value) : false)
const waitingForConfirm = computed(() => rental.value?.status === 'pending')
const canApplyVoucher = computed(() =>
  ['draft', 'pending', 'awaiting_payment'].includes(rental.value?.status ?? ''),
)
const latestReceipt = computed(() => rental.value?.receipts[0] ?? null)
const cancelOpen = ref(false)
const closed = computed(() => ['cancelled', 'rejected'].includes(rental.value?.status ?? ''))
const productName = computed(() => {
  const items = rental.value?.items ?? []
  const first = items[0]?.product.name || rental.value?.code || 'Rental'
  return items.length > 1 ? `${first} + ${items.length - 1} more` : first
})
const productImage = computed(() => {
  const slug = rental.value?.items[0]?.product.slug
  return slug ? productVisual(slug) : '/storefront/action-camera.png'
})
const stepIndex = computed(() => {
  if (!rental.value) {
    return 0
  }
  if (!rental.value.waiver) {
    return 1
  }
  if (!rental.value.identity) {
    return 2
  }
  return rental.value.status === 'draft' ? 3 : 4
})
const nextLabel = computed(() => rental.value ? customerRentalNextLabel(rental.value) : null)
const nextPath = computed(() => rental.value ? customerRentalNextPath(rental.value) : '')
const nextHint = computed(() => {
  if (canSignWaiver.value) {
    return 'Read and sign the rental agreement to continue.'
  }
  if (canUploadIdentity.value) {
    return 'Take a photo of your government ID and a selfie holding it.'
  }
  if (canSubmit.value) {
    return 'Everything is ready. Send your request to the shop.'
  }
  if (canPay.value) {
    return 'Open the payment page to see how much to send and where.'
  }
  return ''
})

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

async function copyCode() {
  if (!rental.value) {
    return
  }
  try {
    await navigator.clipboard.writeText(rental.value.code)
    toast.add({ title: 'Booking code copied', color: 'success' })
  }
  catch {
    toast.add({ title: 'Could not copy the booking code.', color: 'error' })
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
    cancelOpen.value = false
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
  <section class="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8">
    <CatalogNotice
      v-if="error?.statusCode === 503"
      title="Rentals are not connected"
      description="Add live Supabase credentials to load this request."
    />

    <div
      v-else-if="rental"
      class="space-y-6"
    >
      <NuxtLink
        to="/my-rentals"
        class="inline-flex items-center gap-1 text-sm text-[#5c6a64] hover:text-[#12201a]"
      >
        <UIcon
          name="i-lucide-arrow-left"
          class="size-4"
        />
        My rentals
      </NuxtLink>

      <section class="storefront-card overflow-hidden rounded-2xl">
        <div class="flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6">
          <div class="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-[#f4f6f5] ring-1 ring-[#12201a]/6 sm:size-28">
            <img
              :src="productImage"
              :alt="productName"
              class="size-full object-contain p-3"
            >
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs font-semibold uppercase tracking-[0.16em] text-[#5c6a64]">Rental request</span>
              <span class="rounded-md bg-[#f4f6f5] px-1.5 py-0.5 font-mono text-xs text-[#3b4a44]">{{ rental.code }}</span>
              <button
                type="button"
                class="text-[#5c6a64] hover:text-[#12201a]"
                aria-label="Copy booking code"
                @click="copyCode"
              >
                <UIcon
                  name="i-lucide-copy"
                  class="size-3.5"
                />
              </button>
            </div>
            <h1 class="mt-1.5 text-2xl font-semibold tracking-tight break-words text-[#12201a] sm:text-3xl">
              {{ productName }}
            </h1>
            <p class="mt-1 flex items-center gap-1.5 text-sm text-[#3b4a44]">
              <UIcon
                name="i-lucide-calendar"
                class="size-4 shrink-0 text-[#5c6a64]"
              />
              {{ formatBookingDateRange(rental.startsOn, rental.endsOn) }}
            </p>
            <div class="mt-3 flex flex-wrap items-center gap-1.5">
              <StatusBadge :status="rental.status" />
              <PaymentStatusBadge :rental="rental" />
            </div>
          </div>
        </div>
        <div
          v-if="!closed"
          class="border-t border-[#12201a]/8 bg-[#fbfcfb] px-5 py-4 sm:px-6"
        >
          <BookingSteps :current="stepIndex" />
        </div>
      </section>

      <section
        v-if="nextLabel && nextLabel !== 'Waiting for confirmation'"
        class="flex flex-col gap-4 rounded-2xl bg-[#12201a] p-5 text-white sm:flex-row sm:items-center sm:justify-between sm:p-6"
      >
        <div class="min-w-0">
          <p class="text-xs font-semibold uppercase tracking-[0.16em] text-white/60">
            Next step
          </p>
          <p class="mt-1 text-lg font-semibold">
            {{ nextLabel }}
          </p>
          <p
            v-if="nextHint"
            class="mt-0.5 text-sm text-white/70"
          >
            {{ nextHint }}
          </p>
        </div>
        <UButton
          v-if="canSubmit"
          size="lg"
          trailing-icon="i-lucide-send"
          class="w-full justify-center rounded-full bg-white text-[#12201a] hover:bg-white/90 sm:w-auto"
          :loading="submitting"
          @click="submitRental"
        >
          Submit request
        </UButton>
        <UButton
          v-else
          :to="nextPath"
          size="lg"
          trailing-icon="i-lucide-arrow-right"
          class="w-full justify-center rounded-full bg-white text-[#12201a] hover:bg-white/90 sm:w-auto"
        >
          {{ nextLabel }}
        </UButton>
      </section>

      <div
        v-if="waitingForConfirm"
        class="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-900"
      >
        <UIcon
          name="i-lucide-clock"
          class="mt-0.5 size-5 shrink-0 text-sky-600"
        />
        <p>
          <span class="font-semibold">Waiting for the shop.</span>
          Your dates are reserved for 24 hours. If the shop does not confirm this booking in that time, the request is cancelled.
        </p>
      </div>

      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div class="min-w-0 space-y-6">
          <section class="storefront-card rounded-2xl p-5 sm:p-6">
            <h2 class="flex items-center gap-2 font-semibold text-[#12201a]">
              <UIcon
                name="i-lucide-calendar-range"
                class="size-4 text-[#5c6a64]"
              />
              Schedule
            </h2>
            <dl class="mt-4 grid gap-4 text-sm sm:grid-cols-2">
              <div class="rounded-xl bg-[#f4f6f5] px-4 py-3">
                <dt class="text-xs text-[#5c6a64]">
                  Pickup
                </dt>
                <dd class="mt-0.5 font-medium text-[#12201a]">
                  {{ formatBusinessDateTime(rental.pickupAt) }}
                </dd>
              </div>
              <div class="rounded-xl bg-[#f4f6f5] px-4 py-3">
                <dt class="text-xs text-[#5c6a64]">
                  Return
                </dt>
                <dd class="mt-0.5 font-medium text-[#12201a]">
                  {{ formatBusinessDateTime(rental.returnAt) }}
                </dd>
              </div>
            </dl>
          </section>

          <RentalReschedule
            v-if="rental.status === 'draft'"
            :rental="rental"
            @rescheduled="refresh()"
          />

          <section class="storefront-card rounded-2xl p-5 sm:p-6">
            <h2 class="flex items-center gap-2 font-semibold text-[#12201a]">
              <UIcon
                name="i-lucide-package"
                class="size-4 text-[#5c6a64]"
              />
              Equipment
            </h2>
            <ul class="mt-4 space-y-2">
              <li
                v-for="item in rental.items"
                :key="item.uuid"
                class="flex items-center justify-between gap-3 rounded-xl border border-[#12201a]/8 px-4 py-3 text-sm"
              >
                <span class="min-w-0 font-medium break-words text-[#12201a]">{{ item.product.name }}</span>
                <span class="shrink-0 text-[#5c6a64]">Qty {{ item.quantity }}</span>
              </li>
            </ul>
            <p
              v-if="rental.notes"
              class="mt-4 rounded-xl bg-[#f4f6f5] px-4 py-3 text-sm text-[#3b4a44]"
            >
              <span class="font-medium text-[#12201a]">Your notes:</span> {{ rental.notes }}
            </p>
          </section>

          <section class="storefront-card rounded-2xl p-5 sm:p-6">
            <h2 class="flex items-center gap-2 font-semibold text-[#12201a]">
              <UIcon
                name="i-lucide-list-checks"
                class="size-4 text-[#5c6a64]"
              />
              Requirements
            </h2>
            <ul class="mt-4 space-y-3">
              <li class="flex items-start gap-3 rounded-xl border border-[#12201a]/8 px-4 py-3">
                <span
                  class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full"
                  :class="rental.waiver ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'"
                >
                  <UIcon
                    :name="rental.waiver ? 'i-lucide-check' : 'i-lucide-file-signature'"
                    class="size-4"
                  />
                </span>
                <div class="min-w-0 flex-1 text-sm">
                  <p class="font-medium text-[#12201a]">
                    Rental agreement
                  </p>
                  <p
                    v-if="rental.waiver"
                    class="mt-0.5 text-[#5c6a64]"
                  >
                    Signed by {{ rental.waiver.signerName }} on {{ formatBusinessDateTime(rental.waiver.acceptedAt) }}.
                  </p>
                  <p
                    v-else
                    class="mt-0.5 text-[#5c6a64]"
                  >
                    Still needs your signature.
                  </p>
                </div>
                <UButton
                  v-if="canSignWaiver"
                  :to="`/rentals/${rental.code}/waiver`"
                  size="sm"
                  class="shrink-0 rounded-full"
                >
                  Sign
                </UButton>
              </li>
              <li class="flex items-start gap-3 rounded-xl border border-[#12201a]/8 px-4 py-3">
                <span
                  class="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full"
                  :class="rental.identity ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'"
                >
                  <UIcon
                    :name="rental.identity ? 'i-lucide-check' : 'i-lucide-id-card'"
                    class="size-4"
                  />
                </span>
                <div class="min-w-0 flex-1 text-sm">
                  <p class="font-medium text-[#12201a]">
                    Identity verification
                  </p>
                  <p class="mt-0.5 text-[#5c6a64]">
                    {{ rental.identity ? 'Government ID and selfie submitted.' : 'Government ID and a selfie holding it are needed.' }}
                  </p>
                </div>
                <UButton
                  v-if="canUploadIdentity"
                  :to="`/rentals/${rental.code}/verify`"
                  size="sm"
                  class="shrink-0 rounded-full"
                >
                  Upload
                </UButton>
              </li>
            </ul>
          </section>
        </div>

        <aside class="space-y-4 lg:sticky lg:top-24">
          <section class="storefront-card rounded-2xl p-5">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <h2 class="flex items-center gap-2 font-semibold text-[#12201a]">
                <UIcon
                  name="i-lucide-wallet"
                  class="size-4 text-[#5c6a64]"
                />
                Payment
              </h2>
              <PaymentStatusBadge :rental="rental" />
            </div>
            <p
              v-if="rental.voucher"
              class="mt-3 flex items-center gap-1.5 text-sm text-emerald-800"
            >
              <UIcon
                name="i-lucide-ticket-check"
                class="size-4"
              />
              Voucher {{ rental.voucher.code }} applied
            </p>
            <UButton
              v-if="canPay"
              :to="`/rentals/${rental.code}/pay`"
              size="lg"
              trailing-icon="i-lucide-arrow-right"
              class="mt-4 w-full justify-center rounded-full"
            >
              Pay now
            </UButton>
            <UButton
              v-if="latestReceipt"
              :to="`/receipts/${latestReceipt.receiptNumber}`"
              color="neutral"
              variant="outline"
              icon="i-lucide-receipt"
              class="mt-3 w-full justify-center rounded-full"
            >
              View receipt
            </UButton>
          </section>

          <section
            v-if="canPay"
            class="storefront-card rounded-2xl border-l-4 border-l-[#1877f2] p-5"
          >
            <h2 class="font-semibold text-[#12201a]">
              Send your proof of payment
            </h2>
            <p class="mt-1 text-sm leading-6 text-[#3b4a44]">
              After you pay, message a screenshot of your payment to our Facebook page with your booking code
              <span class="font-semibold text-[#12201a]">{{ rental.code }}</span>.
            </p>
            <UButton
              :to="FACEBOOK_MESSENGER_URL"
              target="_blank"
              rel="noopener"
              icon="i-lucide-facebook"
              class="mt-4 w-full justify-center rounded-full bg-[#1877f2] hover:bg-[#166fe5]"
            >
              Message us on Facebook
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-copy"
              class="mt-2 w-full justify-center rounded-full"
              @click="copyCode"
            >
              Copy booking code
            </UButton>
          </section>

          <RentalVoucherForm
            v-if="canApplyVoucher"
            :rental-uuid="rental.uuid"
            :voucher="rental.voucher"
            :editable="true"
            @applied="refresh()"
          />

          <section
            v-if="canCancel"
            class="rounded-2xl border border-[#12201a]/8 bg-white p-5"
          >
            <template v-if="!cancelOpen">
              <UButton
                color="error"
                variant="ghost"
                icon="i-lucide-x-circle"
                class="w-full justify-center rounded-full"
                @click="cancelOpen = true"
              >
                Cancel request
              </UButton>
            </template>
            <template v-else>
              <p class="text-sm font-medium text-[#12201a]">
                Cancel this request?
              </p>
              <p class="mt-1 text-xs text-[#5c6a64]">
                Your dates will be released. This cannot be undone.
              </p>
              <div class="mt-3 flex gap-2">
                <UButton
                  color="error"
                  class="flex-1 justify-center rounded-full"
                  :loading="cancelling"
                  @click="cancelRental"
                >
                  Yes, cancel
                </UButton>
                <UButton
                  color="neutral"
                  variant="outline"
                  class="flex-1 justify-center rounded-full"
                  :disabled="cancelling"
                  @click="cancelOpen = false"
                >
                  Keep it
                </UButton>
              </div>
            </template>
          </section>
        </aside>
      </div>
    </div>
  </section>
</template>
