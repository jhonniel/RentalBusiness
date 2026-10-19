<script setup lang="ts">
import type { PublicRental } from '~/types/rental'
import type { AdminSystemUser } from '~/types/notification'
import { formatBusinessDateTime } from '~/utils/datetime'
import { amountDue, canCompleteAdminRental, canMarkAdminRentalPaid, SHOP_PAYMENT_METHODS } from '~/utils/rental'
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
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-wider text-lumen-700">
            {{ rental.code }}
          </p>
          <h2 class="mt-2 text-2xl font-medium text-stone-900">
            Rental request
          </h2>
          <div class="mt-3">
            <StatusBadge :status="rental.status" />
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="canOpenContinue"
            :to="`/admin/rentals/${rental.uuid}/continue`"
            color="neutral"
            variant="outline"
          >
            {{ canModify && rental.status !== 'draft' ? 'Edit booking' : 'Continue form' }}
          </UButton>
          <UButton
            v-if="canConfirm"
            :loading="confirming"
            @click="confirmBooking"
          >
            Confirm booking
          </UButton>
          <div
            v-if="canMarkPaid"
            class="flex flex-wrap items-center gap-2"
          >
            <select
              v-model="paymentMethod"
              class="h-9 rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-800"
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
              :loading="paying"
              @click="markPaid"
            >
              Mark as paid
            </UButton>
          </div>
          <UButton
            v-if="canFinish"
            :loading="completing"
            @click="finishRental"
          >
            Mark rental done
          </UButton>
          <UButton
            v-if="canApprove"
            :loading="approving"
            @click="approve"
          >
            Approve
          </UButton>
          <UButton
            v-if="rental.receipts[0]"
            :to="`/receipts/${rental.receipts[0].receiptNumber}`"
            color="neutral"
            variant="outline"
          >
            Receipt
          </UButton>
        </div>
      </div>

      <div class="grid gap-6 xl:grid-cols-2 xl:items-start">
        <div class="space-y-6">
          <section class="rounded-xl border border-stone-200 bg-white p-5 text-sm">
            <h3 class="font-medium text-stone-900">
              Customer
            </h3>
            <p class="mt-2 text-stone-600">
              {{ rental.customer ? `${rental.customer.firstName} ${rental.customer.lastName}` : 'Unknown customer' }}
            </p>
            <p class="break-all text-stone-500">
              {{ rental.customer?.email || 'No account email' }}
            </p>
            <p
              v-if="rental.customer?.phone"
              class="text-stone-500"
            >
              {{ rental.customer.phone }}
            </p>
            <p
              v-if="rental.commissioner && !canModify"
              class="mt-3 text-stone-700"
            >
              Commissioner {{ rental.commissioner.firstName }} {{ rental.commissioner.lastName }}
              · commission {{ formatMoney(rental.commissionAmount || 0) }}
            </p>
            <div
              v-if="canModify"
              class="mt-4 space-y-2"
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

          <section class="rounded-xl border border-stone-200 bg-white p-5 text-sm">
            <h3 class="font-medium text-stone-900">
              Schedule
            </h3>
            <p class="mt-2 text-stone-600">
              {{ formatBusinessDateTime(rental.pickupAt) }} – {{ formatBusinessDateTime(rental.returnAt) }}
            </p>
          </section>

          <AdminRentalExtensions
            :rental="rental"
            @extended="refresh"
          />

          <section class="rounded-xl border border-stone-200 bg-white p-5">
            <h3 class="text-sm font-medium text-stone-900">
              Equipment
            </h3>
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
            <p
              v-if="rental.voucher"
              class="mt-3 text-sm text-stone-600"
            >
              Voucher {{ rental.voucher.code }} · −{{ formatMoney(rental.discountAmount) }}
            </p>
            <p class="mt-3 text-sm text-stone-600">
              Rent {{ formatMoney(rental.totalAmount) }}
            </p>
            <p class="text-sm text-stone-600">
              Deposit {{ formatMoney(rental.depositAmount) }}
            </p>
            <p class="mt-1 text-sm font-medium">
              Amount due {{ formatMoney(amountDue(rental)) }}
            </p>
          </section>
        </div>

        <div class="space-y-6">
          <section
            id="waiver"
            class="rounded-xl border border-stone-200 bg-white p-5 text-sm"
          >
            <h3 class="font-medium text-stone-900">
              Rental agreement
            </h3>
            <p
              v-if="sendWaiver && canInvite"
              class="mt-2 text-stone-600"
            >
              This booking is saved. Copy the waiver link from the confirmation, or create one here. The customer fills any missing name, email, phone, and ID photos before they can sign.
            </p>
        <template v-if="rental.waiver">
          <dl class="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt class="text-stone-500">Agreement</dt>
              <dd class="mt-0.5 text-stone-800">
                {{ rental.waiver.version.version }}
              </dd>
            </div>
            <div>
              <dt class="text-stone-500">Status</dt>
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
              <dt class="text-stone-500">Accepted by</dt>
              <dd class="mt-0.5 text-stone-800">
                {{ rental.waiver.signerName }}
              </dd>
            </div>
            <div>
              <dt class="text-stone-500">Email</dt>
              <dd class="mt-0.5 break-all text-stone-800">
                {{ rental.waiver.signerEmail || 'Not recorded' }}
              </dd>
            </div>
            <div>
              <dt class="text-stone-500">Mobile</dt>
              <dd class="mt-0.5 text-stone-800">
                {{ rental.waiver.signerPhone || rental.customer?.phone || 'Not recorded' }}
              </dd>
            </div>
            <div>
              <dt class="text-stone-500">Accepted</dt>
              <dd class="mt-0.5 text-stone-800">
                {{ formatBusinessDateTime(rental.waiver.acceptedAt) }}
              </dd>
            </div>
            <div>
              <dt class="text-stone-500">Privacy Policy</dt>
              <dd class="mt-0.5 text-stone-800">
                {{ rental.waiver.privacyPolicyVersion || 'Not recorded' }}
              </dd>
            </div>
            <div>
              <dt class="text-stone-500">Terms & Conditions</dt>
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

      <section class="rounded-xl border border-stone-200 bg-white p-5 text-sm">
        <h3 class="font-medium text-stone-900">
          Identity documents
        </h3>
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

      <section class="rounded-xl border border-red-200 bg-red-50 p-5">
        <h3 class="text-sm font-medium text-red-900">
          Delete
        </h3>
        <p class="mt-1 text-sm text-red-800">
          Permanently removes this rental, its payments, receipts, waiver, and ID files.
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
    </template>
  </div>
</template>
