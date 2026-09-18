<script setup lang="ts">
import type { PublicRental } from '~/types/rental'
import { formatBusinessDate, formatBusinessDateTime } from '~/utils/datetime'
import { renderWaiverBody } from '~/utils/waiver'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const toast = useToast()
const { formatMoney } = useCurrency()
const identifier = computed(() => String(route.params.id))
const approving = ref(false)

const { data: rental, error, refresh } = await useFetch<PublicRental>(
  () => `/api/admin/rentals/${identifier.value}`,
)
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

const canApprove = computed(() => rental.value?.status === 'paid')

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
            <p
              v-if="rental.customer?.phone"
              class="text-stone-500"
            >
              {{ rental.customer.phone }}
            </p>
          </section>

          <section class="rounded-xl border border-stone-200 bg-white p-5 text-sm">
            <h3 class="font-medium text-stone-900">
              Schedule
            </h3>
            <p class="mt-2 text-stone-600">
              {{ formatBusinessDate(rental.startsOn) }} – {{ formatBusinessDate(rental.endsOn) }}
            </p>
          </section>

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
            <p class="mt-3 text-sm font-medium">
              Total {{ formatMoney(rental.totalAmount) }}
            </p>
          </section>
        </div>

        <div class="space-y-6">
          <section class="rounded-xl border border-stone-200 bg-white p-5 text-sm">
            <h3 class="font-medium text-stone-900">
              Rental agreement
            </h3>
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
            <p class="mt-3 max-h-80 overflow-y-auto whitespace-pre-wrap rounded-lg border border-stone-100 bg-stone-50 p-3 text-xs leading-5 text-stone-700">
              {{ waiverSnapshot }}
            </p>
          </details>
          <div class="mt-4">
            <UButton
              :to="`/admin/rentals/${rental.uuid}/waiver`"
              color="neutral"
              variant="outline"
            >
              View PDF
            </UButton>
          </div>
        </template>
        <p
          v-else
          class="mt-2 text-stone-600"
        >
          No waiver has been accepted on this rental yet.
        </p>
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
      </section>
        </div>
      </div>
    </template>
  </div>
</template>
