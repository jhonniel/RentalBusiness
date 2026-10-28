<script setup lang="ts">
import type { PublicRental } from '~/types/rental'
import type { AdminSystemUser } from '~/types/notification'
import { formatBookingDateRange, formatBusinessDateTime } from '~/utils/datetime'
import { amountDue, canCancelAdminRental, canCompleteAdminRental, canMarkAdminRentalPaid, rentalSalesBreakdown, SHOP_PAYMENT_METHODS } from '~/utils/rental'
import { canSendFeedback } from '~/utils/feedback'
import { LATE_FEE_OUT_STATUSES } from '~/utils/late-fee'
import { renderWaiverBody } from '~/utils/waiver'
import { canModifyAdminRental, canOpenAdminContinue, canResetAdminWaiver, canSendWaiverInvite } from '~/utils/waiver-invite'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const toast = useToast()
const { formatMoney } = useCurrency()
const identifier = computed(() => String(route.params.id))
const approving = ref(false)
const confirming = ref(false)
const paying = ref(false)
const completing = ref(false)
const paymentMethod = ref<(typeof SHOP_PAYMENT_METHODS)[number]>('cash')
const deleteOpen = ref(false)
const deletePending = ref(false)
const cancelOpen = ref(false)
const cancelling = ref(false)
const cancelReason = ref('')

const { data: rental, error, refresh } = await useFetch<PublicRental>(
  () => `/api/admin/rentals/${identifier.value}`,
)
const { data: commissioners } = await useFetch<AdminSystemUser[]>('/api/admin/commissioners')
const commissionerUuid = ref(rental.value?.commissioner?.uuid || '')
const assigning = ref(false)
const assignError = ref('')
const waiverSnapshot = computed(() => {
  if (!rental.value?.waiver) {
    return ''
  }

  return renderWaiverBody(rental.value.waiver.version.body, rental.value.items)
})

if (error.value?.statusCode === 404) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Rental not found',
  })
}

useSiteMeta({
  title: rental.value ? `Rental ${rental.value.code}` : 'Rental',
  path: `/admin/rentals/${identifier.value}`,
})

const canConfirm = computed(() => rental.value?.status === 'pending')
const canModify = computed(() => rental.value ? canModifyAdminRental(rental.value) : false)
const listedCommissioner = computed(() => {
  const uuid = rental.value?.commissioner?.uuid
  return Boolean(uuid && commissioners.value?.some(person => person.uuid === uuid))
})

watch(rental, (value) => {
  if (assigning.value) {
    return
  }
  commissionerUuid.value = value?.commissioner?.uuid || ''
})

async function assignCommissioner() {
  if (!rental.value) {
    return
  }

  assigning.value = true
  assignError.value = ''
  try {
    await $fetch(`/api/admin/rentals/${rental.value.uuid}/commissioner`, {
      method: 'PATCH',
      body: { commissionerUuid: commissionerUuid.value },
    })
    toast.add({
      title: commissionerUuid.value ? 'Commissioner assigned' : 'Commissioner removed',
      color: 'success',
    })
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    assignError.value = payload?.message || 'We could not assign that commissioner.'
  }
  finally {
    assigning.value = false
  }
}
const canInvite = computed(() => rental.value ? canSendWaiverInvite(rental.value) : false)
const canOpenContinue = computed(() => rental.value ? canOpenAdminContinue(rental.value) : false)
const canResetWaiver = computed(() => rental.value ? canResetAdminWaiver(rental.value) : false)
const resetOpen = ref(false)
const resetting = ref(false)
const canMarkPaid = computed(() => rental.value ? canMarkAdminRentalPaid(rental.value) : false)
const canFinish = computed(() => rental.value ? canCompleteAdminRental(rental.value) : false)
const canCancel = computed(() => rental.value ? canCancelAdminRental(rental.value) : false)
const showLateFee = computed(() => {
  const fee = rental.value?.lateFee
  return Boolean(fee && (fee.status !== 'none' || fee.uuid || LATE_FEE_OUT_STATUSES.includes(rental.value!.status)))
})
const showFeedback = computed(() => Boolean(rental.value && canSendFeedback(rental.value.status)))
const sales = computed(() => rental.value ? rentalSalesBreakdown(rental.value) : null)
const commissionStatusLabel = computed(() => {
  if (rental.value?.commissionStatus === 'collected') {
    return 'collected'
  }
  if (rental.value?.commissionStatus === 'unclaimed') {
    return 'recorded, unclaimed'
  }
  return 'recorded when the booking is approved'
})
const paidPayment = computed(() => rental.value?.payments.find(payment => payment.status === 'paid') ?? null)
const hasPaidPayment = computed(() => Boolean(paidPayment.value))
const paidAmount = computed(() => paidPayment.value?.amount ?? 0)
const totalPaid = computed(() => Math.round((rental.value?.payments ?? [])
  .filter(payment => payment.status === 'paid')
  .reduce((sum, payment) => sum + Number(payment.amount), 0) * 100) / 100)
const customerName = computed(() => rental.value?.customer
  ? `${rental.value.customer.firstName} ${rental.value.customer.lastName}`.trim()
  : 'Unknown customer')
const customerInitials = computed(() => customerName.value
  .split(/\s+/)
  .filter(Boolean)
  .slice(0, 2)
  .map(part => part[0]?.toUpperCase())
  .join('') || '?')
const equipmentLabel = computed(() => (rental.value?.items ?? [])
  .map(item => item.quantity > 1 ? `${item.product.name} × ${item.quantity}` : item.product.name)
  .join(', '))
const progress = computed(() => rental.value
  ? [
      { label: 'Waiver', done: Boolean(rental.value.waiver) },
      { label: 'ID', done: Boolean(rental.value.identity) },
      { label: 'Payment', done: hasPaidPayment.value || amountDue(rental.value) === 0 },
    ]
  : [])
const sendWaiver = computed(() => route.hash === '#waiver')

onMounted(() => {
  if (sendWaiver.value) {
    document.getElementById('waiver')?.scrollIntoView({ block: 'start' })
  }
})
const canApprove = computed(() =>
  rental.value?.status === 'paid'
  || Boolean(
    rental.value
    && amountDue(rental.value) === 0
    && rental.value.voucher
    && rental.value.status === 'awaiting_payment',
  ),
)

async function resetWaiver() {
  if (!rental.value) {
    return
  }

  resetting.value = true
  try {
    await $fetch(`/api/admin/rentals/${rental.value.uuid}/waiver`, { method: 'DELETE' })
    toast.add({ title: 'Waiver set to unsigned', color: 'success' })
    resetOpen.value = false
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    toast.add({
      title: payload?.message || 'We could not change that waiver status.',
      color: 'error',
    })
  }
  finally {
    resetting.value = false
  }
}

async function confirmBooking() {
  if (!rental.value) {
    return
  }

  confirming.value = true
  try {
    await $fetch(`/api/admin/rentals/${rental.value.uuid}/confirm`, { method: 'POST' })
    toast.add({ title: 'Booking confirmed', color: 'success' })
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    toast.add({
      title: payload?.message || 'We could not confirm that booking.',
      color: 'error',
    })
  }
  finally {
    confirming.value = false
  }
}

async function finishRental() {
  if (!rental.value) {
    return
  }

  completing.value = true
  try {
    await $fetch(`/api/admin/rentals/${rental.value.uuid}/complete`, { method: 'POST' })
    toast.add({ title: 'Rental finished and deposit removed from sales', color: 'success' })
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    toast.add({
      title: payload?.message || 'We could not finish that rental.',
      color: 'error',
    })
  }
  finally {
    completing.value = false
  }
}

async function markPaid() {
  if (!rental.value) {
    return
  }

  paying.value = true
  try {
    await $fetch(`/api/admin/rentals/${rental.value.uuid}/paid`, {
      method: 'POST',
      body: { paymentMethod: paymentMethod.value },
    })
    toast.add({ title: 'Payment recorded as a sale', color: 'success' })
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    toast.add({
      title: payload?.message || 'We could not record that payment.',
      color: 'error',
    })
  }
  finally {
    paying.value = false
  }
}

async function approve() {
  if (!rental.value) {
    return
  }

  approving.value = true
  try {
    await $fetch(`/api/admin/rentals/${rental.value.uuid}/approve`, { method: 'POST' })
    toast.add({ title: 'Rental approved', color: 'success' })
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    toast.add({
      title: payload?.message || 'We could not approve that rental.',
      color: 'error',
    })
  }
  finally {
    approving.value = false
  }
}

async function cancelBooking() {
  if (!rental.value) {
    return
  }

  cancelling.value = true
  try {
    await $fetch(`/api/admin/rentals/${rental.value.uuid}/cancel`, {
      method: 'POST',
      body: { reason: cancelReason.value },
    })
    toast.add({ title: 'Booking cancelled', color: 'success' })
    cancelOpen.value = false
    cancelReason.value = ''
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    toast.add({
      title: payload?.message || 'We could not cancel that booking.',
      color: 'error',
    })
  }
  finally {
    cancelling.value = false
  }
}

async function removeRental() {
  if (!rental.value) {
    return
  }

  deletePending.value = true
  try {
    await $fetch(`/api/admin/rentals/${rental.value.uuid}`, { method: 'DELETE' })
    toast.add({ title: 'Rental deleted', color: 'success' })
    await navigateTo('/admin/rentals')
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    toast.add({
      title: payload?.message || 'We could not delete that rental.',
      color: 'error',
    })
  }
  finally {
    deletePending.value = false
  }
}
</script>

<template>
  <div class="w-full space-y-6">
    <UButton
      to="/admin/rentals"
      color="neutral"
      variant="ghost"
      class="-ml-2"
    >
      Back to rentals
    </UButton>

    <AdminNotice
      v-if="error?.statusCode === 503"
      title="Rentals are not connected"
      description="Add live Supabase credentials to manage this request."
    />

    <template v-else-if="rental">
      <section class="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
        <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <span class="text-xs font-medium uppercase tracking-wider text-stone-500">Rental request</span>
              <span class="rounded-md bg-stone-100 px-2 py-0.5 font-mono text-xs font-medium text-stone-700">{{ rental.code }}</span>
              <StatusBadge :status="rental.status" />
            </div>
            <h2 class="mt-2 text-2xl font-semibold tracking-tight break-words text-stone-900">
              {{ equipmentLabel || 'Rental request' }}
            </h2>
            <p class="mt-1 text-sm text-stone-600">
              {{ customerName }} · {{ formatBookingDateRange(rental.startsOn, rental.endsOn) }}<template v-if="sales">
                · {{ sales.days }} day{{ sales.days === 1 ? '' : 's' }}
              </template>
            </p>
          </div>
          <div class="flex flex-wrap items-center gap-2 lg:justify-end">
            <UButton
              v-if="rental.receipts[0]"
              :to="`/receipts/${rental.receipts[0].receiptNumber}`"
              color="neutral"
              variant="ghost"
              icon="i-lucide-receipt"
            >
              Receipt
            </UButton>
            <UButton
              v-if="canOpenContinue"
              :to="`/admin/rentals/${rental.uuid}/continue`"
              color="neutral"
              variant="outline"
              icon="i-lucide-pencil"
            >
              {{ canModify && rental.status !== 'draft' ? 'Edit booking' : 'Continue form' }}
            </UButton>
            <UButton
              v-if="canConfirm"
              icon="i-lucide-check"
              :loading="confirming"
              @click="confirmBooking"
            >
              Confirm booking
            </UButton>
            <div
              v-if="canMarkPaid"
              class="flex items-center gap-1 rounded-lg border border-stone-200 bg-stone-50 p-1"
            >
              <select
                v-model="paymentMethod"
                class="h-8 rounded-md border-0 bg-transparent px-2 text-sm text-stone-800 focus:ring-0"
                aria-label="Payment method"
                :disabled="paying"
              >
                <option
                  v-for="method in SHOP_PAYMENT_METHODS"
                  :key="method"
                  :value="method"
                >
                  {{ method === 'gcash' ? 'GCash' : method === 'maya' ? 'Maya' : method === 'bank' ? 'Bank' : 'Cash' }}
                </option>
              </select>
              <UButton
                size="sm"
                icon="i-lucide-wallet"
                :loading="paying"
                @click="markPaid"
              >
                Mark as paid
              </UButton>
            </div>
            <UButton
              v-if="canApprove"
              icon="i-lucide-badge-check"
              :loading="approving"
              @click="approve"
            >
              Approve
            </UButton>
            <UButton
              v-if="canFinish"
              icon="i-lucide-flag"
              :loading="completing"
              @click="finishRental"
            >
              Mark rental done
            </UButton>
          </div>
        </div>

        <dl class="mt-5 grid gap-4 border-t border-stone-100 pt-5 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div class="flex items-start gap-3">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
              <UIcon
                name="i-lucide-calendar-arrow-up"
                class="size-4"
              />
            </span>
            <div class="min-w-0">
              <dt class="text-xs text-stone-500">
                Pickup
              </dt>
              <dd class="mt-0.5 font-medium text-stone-900">
                {{ formatBusinessDateTime(rental.pickupAt) }}
              </dd>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
              <UIcon
                name="i-lucide-calendar-arrow-down"
                class="size-4"
              />
            </span>
            <div class="min-w-0">
              <dt class="text-xs text-stone-500">
                Return
              </dt>
              <dd class="mt-0.5 font-medium text-stone-900">
                {{ formatBusinessDateTime(rental.returnAt) }}
              </dd>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
              <UIcon
                name="i-lucide-wallet"
                class="size-4"
              />
            </span>
            <div class="min-w-0">
              <dt class="text-xs text-stone-500">
                {{ sales ? 'Actual sale' : 'Amount due' }}
              </dt>
              <dd class="mt-0.5 font-medium tabular-nums text-stone-900">
                {{ formatMoney(sales ? sales.shopKeeps : amountDue(rental)) }}
              </dd>
              <dd class="mt-0.5 text-xs tabular-nums text-stone-500">
                <template v-if="totalPaid > 0">
                  {{ formatMoney(totalPaid) }} paid in total
                </template>
                <template v-else>
                  Not paid yet · {{ formatMoney(amountDue(rental)) }} due
                </template>
              </dd>
            </div>
          </div>
          <div class="flex items-start gap-3">
            <span class="flex size-9 shrink-0 items-center justify-center rounded-lg bg-stone-100 text-stone-600">
              <UIcon
                name="i-lucide-list-checks"
                class="size-4"
              />
            </span>
            <div class="min-w-0">
              <dt class="text-xs text-stone-500">
                Progress
              </dt>
              <dd class="mt-1 flex flex-wrap gap-1.5">
                <span
                  v-for="step in progress"
                  :key="step.label"
                  class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="step.done ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-stone-500'"
                >
                  <UIcon
                    :name="step.done ? 'i-lucide-check' : 'i-lucide-circle-dashed'"
                    class="size-3"
                  />
                  {{ step.label }}
                </span>
              </dd>
            </div>
          </div>
        </dl>
      </section>

      <div class="grid gap-6 xl:grid-cols-2 xl:items-start">
        <div class="space-y-6">
          <section class="rounded-2xl border border-stone-200 bg-white p-5 text-sm">
            <h3 class="flex items-center gap-2 font-medium text-stone-900">
              <UIcon
                name="i-lucide-user"
                class="size-4 text-stone-500"
              />
              Customer
            </h3>
            <div class="mt-4 flex items-start gap-3">
              <span class="flex size-11 shrink-0 items-center justify-center rounded-full bg-[#12201a] text-sm font-semibold text-white">
                {{ customerInitials }}
              </span>
              <div class="min-w-0 space-y-1">
                <p class="font-medium text-stone-900">
                  {{ customerName }}
                </p>
                <p class="flex items-center gap-1.5 break-all text-stone-600">
                  <UIcon
                    name="i-lucide-mail"
                    class="size-3.5 shrink-0 text-stone-400"
                  />
                  {{ rental.customer?.email || 'No account email' }}
                </p>
                <p
                  v-if="rental.customer?.phone"
                  class="flex items-center gap-1.5 text-stone-600"
                >
                  <UIcon
                    name="i-lucide-phone"
                    class="size-3.5 shrink-0 text-stone-400"
                  />
                  {{ rental.customer.phone }}
                </p>
              </div>
            </div>
            <p
              v-if="rental.commissioner && !canModify"
              class="mt-3 text-stone-700"
            >
              Commissioner {{ rental.commissioner.firstName }} {{ rental.commissioner.lastName }}
              · commission {{ formatMoney(rental.commissionAmount || 0) }}
            </p>
            <div
              v-if="canModify"
              class="mt-5 space-y-2 border-t border-stone-100 pt-4"
            >
              <label class="block">
                <span class="mb-1.5 block text-stone-700">Commissioner</span>
                <select
                  v-model="commissionerUuid"
                  class="h-10 w-full rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-800"
                  :disabled="assigning"
                >
                  <option value="">
                    No commissioner
                  </option>
                  <option
                    v-if="rental.commissioner && !listedCommissioner"
                    :value="rental.commissioner.uuid"
                  >
                    {{ rental.commissioner.firstName }} {{ rental.commissioner.lastName }}
                  </option>
                  <option
                    v-for="person in commissioners"
                    :key="person.uuid"
                    :value="person.uuid"
                  >
                    {{ person.firstName }} {{ person.lastName }}
                  </option>
                </select>
              </label>
              <p
                v-if="rental.commissioner"
                class="text-stone-600"
              >
                Commission {{ formatMoney(rental.commissionAmount || 0) }}
              </p>
              <p class="text-xs text-stone-500">
                Choose a commissioner and save. Their commission is recorded on this booking, including after it is confirmed.
              </p>
              <p
                v-if="assignError"
                class="text-sm text-red-800"
              >
                {{ assignError }}
              </p>
              <UButton
                class="w-full justify-center sm:w-auto"
                :loading="assigning"
                @click="assignCommissioner"
              >
                Save commissioner
              </UButton>
            </div>
          </section>

          <AdminRentalLateFee
            v-if="showLateFee"
            :rental="rental"
            @changed="refresh"
          />

          <AdminRentalExtensions
            :rental="rental"
            @extended="refresh"
          />

          <AdminRentalFeedback
            v-if="showFeedback"
            :rental="rental"
          />

          <section class="rounded-2xl border border-stone-200 bg-white p-5">
            <h3 class="flex items-center gap-2 text-sm font-medium text-stone-900">
              <UIcon
                name="i-lucide-package"
                class="size-4 text-stone-500"
              />
              Equipment
            </h3>
            <div
              v-if="sales"
              class="mt-3 rounded-xl bg-[#12201a] p-4 text-white sm:p-5"
            >
              <div class="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p class="text-xs font-medium uppercase tracking-wider text-white/60">
                    Actual sale
                  </p>
                  <p class="mt-1 text-3xl font-semibold tabular-nums">
                    {{ formatMoney(sales.shopKeeps) }}
                  </p>
                </div>
                <p class="text-xs text-white/60">
                  What the shop keeps from this booking
                </p>
              </div>
              <dl class="mt-4 grid gap-2 border-t border-white/10 pt-3 text-xs sm:grid-cols-4">
                <div>
                  <dt class="text-white/60">
                    Rent before discounts
                  </dt>
                  <dd class="mt-0.5 text-sm font-medium tabular-nums">
                    {{ formatMoney(sales.grossRent) }}
                  </dd>
                </div>
                <div>
                  <dt class="text-white/60">
                    Discounts
                  </dt>
                  <dd class="mt-0.5 text-sm font-medium tabular-nums">
                    −{{ formatMoney(sales.discounts) }}
                  </dd>
                </div>
                <div>
                  <dt class="text-white/60">
                    Commissions
                  </dt>
                  <dd class="mt-0.5 text-sm font-medium tabular-nums">
                    −{{ formatMoney(sales.commission) }}
                  </dd>
                </div>
                <div>
                  <dt class="text-white/60">
                    Deposit (not a sale)
                  </dt>
                  <dd class="mt-0.5 text-sm font-medium tabular-nums text-white/70">
                    {{ formatMoney(rental.depositAmount) }} excluded
                  </dd>
                </div>
              </dl>
              <p
                v-if="sales.pendingExtension > 0"
                class="mt-3 text-xs text-amber-200"
              >
                Unpaid extension of {{ formatMoney(sales.pendingExtension) }} is not counted until it is paid.
              </p>
            </div>
            <ul class="mt-3 divide-y divide-stone-100">
              <li
                v-for="item in rental.items"
                :key="item.uuid"
                class="flex justify-between gap-4 py-3 text-sm"
              >
                <span>{{ item.product.name }} × {{ item.quantity }}</span>
                <span>{{ formatMoney(item.lineTotal) }}</span>
              </li>
            </ul>
            <dl
              v-if="sales"
              class="mt-3 space-y-1.5 border-t border-stone-100 pt-3 text-sm"
            >
              <div class="flex justify-between gap-4 font-medium text-stone-800">
                <dt>
                  {{ sales.extensions.length ? 'First booking' : 'Booking' }}
                  · {{ formatBookingDateRange(rental.startsOn, sales.baseEndsOn) }}
                  · {{ sales.baseDays }} day{{ sales.baseDays === 1 ? '' : 's' }}
                </dt>
              </div>
              <div
                v-if="sales.baseRateDiscount > 0"
                class="flex justify-between gap-4 pl-3 text-stone-600"
              >
                <dt>Regular rent</dt>
                <dd>{{ formatMoney(sales.baseListRent) }}</dd>
              </div>
              <div
                v-if="sales.baseRateDiscount > 0"
                class="flex justify-between gap-4 pl-3 text-stone-600"
              >
                <dt>Long-stay discount</dt>
                <dd>−{{ formatMoney(sales.baseRateDiscount) }}</dd>
              </div>
              <div class="flex justify-between gap-4 pl-3 text-stone-700">
                <dt>Rent</dt>
                <dd>{{ formatMoney(sales.baseRent) }}</dd>
              </div>
              <div
                v-if="rental.commissioner && sales.commissionPerDay > 0"
                class="flex flex-wrap justify-between gap-x-4 gap-y-0.5 pl-3 text-stone-600"
              >
                <dt class="min-w-0">
                  Commission · {{ sales.baseDays }} day{{ sales.baseDays === 1 ? '' : 's' }} × {{ formatMoney(sales.commissionPerDay) }}{{ sales.commissionUnits > 1 ? ` × ${sales.commissionUnits}` : '' }}
                  <span class="text-xs text-stone-500">· {{ commissionStatusLabel }}</span>
                </dt>
                <dd>−{{ formatMoney(sales.baseCommission) }}</dd>
              </div>

              <div
                v-for="(extension, index) in sales.extensions"
                :key="extension.uuid"
                class="flex flex-wrap justify-between gap-x-4 gap-y-0.5 pt-1"
              >
                <dt class="min-w-0 text-stone-800">
                  <span class="font-medium">Extension {{ sales.extensions.length > 1 ? index + 1 : '' }}</span>
                  · {{ formatBookingDateRange(extension.previousEndsOn, extension.endsOn) }}
                  · {{ extension.days }} day{{ extension.days === 1 ? '' : 's' }}
                  <UBadge
                    v-if="extension.paymentStatus === 'unpaid'"
                    color="warning"
                    variant="soft"
                    size="sm"
                    class="ml-1"
                  >
                    Unpaid
                  </UBadge>
                  <UBadge
                    v-else-if="extension.paymentStatus === 'paid'"
                    color="success"
                    variant="soft"
                    size="sm"
                    class="ml-1"
                  >
                    Paid
                  </UBadge>
                </dt>
                <dd class="text-stone-700">
                  +{{ formatMoney(extension.addedAmount) }}
                </dd>
                <div
                  v-if="rental.commissioner && sales.commissionPerDay > 0"
                  class="flex w-full justify-between gap-4 pl-3 text-stone-600"
                >
                  <span class="min-w-0">
                    Commission · {{ extension.days }} day{{ extension.days === 1 ? '' : 's' }} × {{ formatMoney(sales.commissionPerDay) }}{{ sales.commissionUnits > 1 ? ` × ${sales.commissionUnits}` : '' }}
                    <span class="text-xs text-stone-500">
                      · {{ extension.paymentStatus === 'unpaid' ? 'counts after the extension is paid' : commissionStatusLabel }}
                    </span>
                  </span>
                  <span :class="extension.paymentStatus === 'unpaid' ? 'text-stone-400 line-through' : ''">−{{ formatMoney(extension.commission) }}</span>
                </div>
              </div>

              <div
                v-if="sales.voucherDiscount > 0"
                class="flex justify-between gap-4 pt-1 text-stone-600"
              >
                <dt>Voucher{{ rental.voucher ? ` ${rental.voucher.code}` : '' }}</dt>
                <dd>−{{ formatMoney(sales.voucherDiscount) }}</dd>
              </div>
              <div class="flex justify-between gap-4 border-t border-stone-100 pt-2 text-stone-800">
                <dt>Total rent · {{ sales.days }} day{{ sales.days === 1 ? '' : 's' }}</dt>
                <dd>{{ formatMoney(sales.rent) }}</dd>
              </div>
              <div
                v-if="sales.pendingExtension > 0"
                class="flex justify-between gap-4 text-amber-800"
              >
                <dt>Unpaid extension · not counted yet</dt>
                <dd>−{{ formatMoney(sales.pendingExtension) }}</dd>
              </div>
              <div
                v-if="rental.commissioner"
                class="flex justify-between gap-4 text-stone-600"
              >
                <dt>Total commission · {{ rental.commissioner.firstName }} {{ rental.commissioner.lastName }}{{ sales.pendingExtension > 0 ? ' (paid days only)' : '' }}</dt>
                <dd>−{{ formatMoney(sales.commission) }}</dd>
              </div>
              <div class="flex justify-between gap-4 font-medium text-stone-900">
                <dt>Shop sales</dt>
                <dd>{{ formatMoney(sales.shopKeeps) }}</dd>
              </div>
              <div class="flex justify-between gap-4 border-t border-stone-100 pt-2 text-stone-600">
                <dt>Deposit (returned after the rental)</dt>
                <dd>{{ formatMoney(rental.depositAmount) }}</dd>
              </div>
              <div class="flex justify-between gap-4 font-medium text-stone-900">
                <dt>Amount due from customer</dt>
                <dd>{{ formatMoney(amountDue(rental)) }}</dd>
              </div>
            </dl>
          </section>
        </div>

        <div class="space-y-6">
          <section
            id="waiver"
            class="rounded-2xl border border-stone-200 bg-white p-5 text-sm"
          >
            <div class="flex items-center justify-between gap-3">
              <h3 class="flex items-center gap-2 font-medium text-stone-900">
                <UIcon
                  name="i-lucide-file-signature"
                  class="size-4 text-stone-500"
                />
                Rental agreement
              </h3>
              <span
                class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                :class="rental.waiver ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'"
              >
                <UIcon
                  :name="rental.waiver ? 'i-lucide-check' : 'i-lucide-clock'"
                  class="size-3"
                />
                {{ rental.waiver ? 'Signed' : 'Not signed' }}
              </span>
            </div>
            <p
              v-if="sendWaiver && canInvite"
              class="mt-2 text-stone-600"
            >
              This booking is saved. Copy the waiver link from the confirmation, or create one here. The customer fills any missing name, email, phone, and ID photos before they can sign.
            </p>
            <template v-if="rental.waiver">
              <dl class="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt class="text-stone-500">
                    Agreement
                  </dt>
                  <dd class="mt-0.5 text-stone-800">
                    {{ rental.waiver.version.version }}
                  </dd>
                </div>
                <div>
                  <dt class="text-stone-500">
                    Status
                  </dt>
                  <dd class="mt-0.5 text-stone-800">
                    Accepted
                  </dd>
                  <div
                    v-if="canResetWaiver"
                    class="mt-3 flex flex-wrap items-center gap-2"
                  >
                    <template v-if="!resetOpen">
                      <UButton
                        color="neutral"
                        variant="outline"
                        size="sm"
                        :disabled="resetting"
                        @click="resetOpen = true"
                      >
                        Change status to unsigned
                      </UButton>
                    </template>
                    <template v-else>
                      <p class="text-sm text-stone-600">
                        Remove this signature so they can agree and sign again?
                      </p>
                      <UButton
                        color="error"
                        size="sm"
                        :loading="resetting"
                        @click="resetWaiver"
                      >
                        Confirm unsigned
                      </UButton>
                      <UButton
                        color="neutral"
                        variant="ghost"
                        size="sm"
                        :disabled="resetting"
                        @click="resetOpen = false"
                      >
                        Cancel
                      </UButton>
                    </template>
                  </div>
                </div>
                <div>
                  <dt class="text-stone-500">
                    Accepted by
                  </dt>
                  <dd class="mt-0.5 text-stone-800">
                    {{ rental.waiver.signerName }}
                  </dd>
                </div>
                <div>
                  <dt class="text-stone-500">
                    Email
                  </dt>
                  <dd class="mt-0.5 break-all text-stone-800">
                    {{ rental.waiver.signerEmail || 'Not recorded' }}
                  </dd>
                </div>
                <div>
                  <dt class="text-stone-500">
                    Mobile
                  </dt>
                  <dd class="mt-0.5 text-stone-800">
                    {{ rental.waiver.signerPhone || rental.customer?.phone || 'Not recorded' }}
                  </dd>
                </div>
                <div>
                  <dt class="text-stone-500">
                    Accepted
                  </dt>
                  <dd class="mt-0.5 text-stone-800">
                    {{ formatBusinessDateTime(rental.waiver.acceptedAt) }}
                  </dd>
                </div>
                <div>
                  <dt class="text-stone-500">
                    Privacy Policy
                  </dt>
                  <dd class="mt-0.5 text-stone-800">
                    {{ rental.waiver.privacyPolicyVersion || 'Not recorded' }}
                  </dd>
                </div>
                <div>
                  <dt class="text-stone-500">
                    Terms & Conditions
                  </dt>
                  <dd class="mt-0.5 text-stone-800">
                    {{ rental.waiver.termsVersion || 'Not recorded' }}
                  </dd>
                </div>
              </dl>
              <details class="mt-4">
                <summary class="cursor-pointer text-sm font-medium text-lumen-700">
                  View agreement snapshot
                </summary>
                <WaiverAgreementText
                  class="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg border border-stone-100 bg-stone-50 p-3 text-xs leading-5 text-stone-700"
                  :text="waiverSnapshot"
                />
              </details>
              <AdminSignedWaiverLink
                class="mt-4"
                :rental-uuid="rental.uuid"
              />
            </template>
            <div
              v-else
              class="mt-2"
            >
              <p class="text-stone-600">
                No waiver has been accepted on this rental yet.
              </p>
              <AdminWaiverLink
                v-if="canInvite"
                class="mt-4"
                plain
                :rental-uuid="rental.uuid"
                :can-invite="canInvite"
                :waiver="rental.waiver"
              />
            </div>
          </section>

          <section class="rounded-2xl border border-stone-200 bg-white p-5 text-sm">
            <div class="flex items-center justify-between gap-3">
              <h3 class="flex items-center gap-2 font-medium text-stone-900">
                <UIcon
                  name="i-lucide-id-card"
                  class="size-4 text-stone-500"
                />
                Identity documents
              </h3>
              <span
                class="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                :class="rental.identity ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'"
              >
                <UIcon
                  :name="rental.identity ? 'i-lucide-check' : 'i-lucide-clock'"
                  class="size-3"
                />
                {{ rental.identity ? 'Submitted' : 'Missing' }}
              </span>
            </div>
            <template v-if="rental.identity">
              <p class="mt-2 text-stone-600">
                Submitted for this rental.
              </p>
              <div class="mt-4 grid gap-4 sm:grid-cols-2">
                <figure>
                  <figcaption class="mb-2 text-stone-500">
                    Government ID
                  </figcaption>
                  <img
                    v-if="rental.identity.governmentIdUrl"
                    :src="rental.identity.governmentIdUrl"
                    alt="Government ID"
                    class="max-h-72 w-full rounded-lg border border-stone-100 object-contain bg-stone-50"
                  >
                  <p
                    v-else
                    class="text-stone-500"
                  >
                    Image is not available.
                  </p>
                </figure>
                <figure>
                  <figcaption class="mb-2 text-stone-500">
                    Selfie with ID
                  </figcaption>
                  <img
                    v-if="rental.identity.selfieUrl"
                    :src="rental.identity.selfieUrl"
                    alt="Selfie holding government ID"
                    class="max-h-72 w-full rounded-lg border border-stone-100 object-contain bg-stone-50"
                  >
                  <p
                    v-else
                    class="text-stone-500"
                  >
                    Image is not available.
                  </p>
                </figure>
              </div>
            </template>
            <p
              v-else
              class="mt-2 text-stone-600"
            >
              No government ID or selfie has been submitted yet.
            </p>
            <AdminIdentityUpload
              class="mt-4"
              plain
              :rental="rental"
              @uploaded="refresh"
            />
          </section>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2 lg:items-start">
        <section
          v-if="canCancel"
          class="rounded-xl border border-amber-200 bg-amber-50 p-5"
        >
          <h3 class="text-sm font-medium text-amber-900">
            Cancel booking
          </h3>
          <p class="mt-1 text-sm text-amber-900">
            Releases the dates and keeps this booking on record.
            <template v-if="hasPaidPayment">
              The {{ formatMoney(paidAmount) }} already paid, including the deposit and down payment, is not refunded and stays in sales.
            </template>
          </p>
          <UButton
            v-if="!cancelOpen"
            class="mt-4"
            color="warning"
            variant="outline"
            @click="cancelOpen = true"
          >
            Cancel booking
          </UButton>
          <div
            v-else
            class="mt-4 space-y-3"
          >
            <label class="block text-sm">
              <span class="mb-1.5 block text-amber-900">Reason (optional)</span>
              <UTextarea
                v-model="cancelReason"
                :rows="2"
                class="w-full"
                :disabled="cancelling"
              />
            </label>
            <div class="flex flex-wrap items-center gap-2">
              <UButton
                color="warning"
                class="w-full justify-center sm:w-auto"
                :loading="cancelling"
                @click="cancelBooking"
              >
                Confirm cancel
              </UButton>
              <UButton
                color="neutral"
                variant="ghost"
                class="w-full justify-center sm:w-auto"
                :disabled="cancelling"
                @click="cancelOpen = false"
              >
                Keep booking
              </UButton>
            </div>
          </div>
        </section>

        <section class="rounded-xl border border-red-200 bg-red-50 p-5">
          <h3 class="text-sm font-medium text-red-900">
            Delete
          </h3>
          <p class="mt-1 text-sm text-red-800">
            Permanently removes this rental, its payments, receipts, waiver, and ID files.
            <template v-if="hasPaidPayment">
              Its {{ formatMoney(paidAmount) }} payment will also leave sales. Cancel the booking instead to keep the non-refundable deposit and down payment recorded.
            </template>
          </p>
          <UButton
            v-if="!deleteOpen"
            class="mt-4"
            color="error"
            @click="deleteOpen = true"
          >
            Delete rental
          </UButton>
          <div
            v-else
            class="mt-4 flex flex-wrap items-center gap-2"
          >
            <p class="text-sm text-red-800">
              Delete {{ rental.code }} forever?
            </p>
            <UButton
              color="error"
              :loading="deletePending"
              @click="removeRental"
            >
              Confirm delete
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              :disabled="deletePending"
              @click="deleteOpen = false"
            >
              Cancel
            </UButton>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
