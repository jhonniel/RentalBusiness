<script setup lang="ts">
import type { PublicRental, RentalListResponse } from '~/types/rental'
import type { SentFeedbackLink } from '~/types/feedback'
import { RENTAL_STATUSES } from '~/utils/constants'
import { formatBookingDateRange } from '~/utils/datetime'
import { formatPickupClock } from '~/utils/rental-window'
import { canModifyAdminRental, canOpenAdminContinue } from '~/utils/waiver-invite'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Rentals',
  path: '/admin/rentals',
})

const searchInput = ref('')
const search = refDebounced(searchInput, 300)
const status = ref('')
const page = ref(1)
const { formatMoney } = useCurrency()

const query = computed(() => ({
  search: search.value || undefined,
  status: status.value || undefined,
  page: page.value,
  pageSize: 20,
}))

const toast = useToast()
const deleteCode = ref('')
const deletePending = ref(false)

const { data, error, pending, refresh } = await useFetch<RentalListResponse>('/api/admin/rentals', {
  query,
  watch: [query],
})

const unavailable = computed(() => error.value?.statusCode === 503)
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / 20)))

watch([search, status], () => {
  page.value = 1
})

const feedbackBusy = ref('')
const feedbackLink = ref<SentFeedbackLink | null>(null)
const feedbackTarget = ref<PublicRental | null>(null)
const feedbackEarns = ref(true)
const feedbackOpen = ref(false)

function openFeedback(rental: PublicRental) {
  feedbackTarget.value = rental
  feedbackLink.value = null
  feedbackEarns.value = true
  feedbackOpen.value = true
}

async function createFeedbackLink() {
  const rental = feedbackTarget.value
  if (!rental) {
    return
  }
  feedbackBusy.value = rental.uuid
  try {
    feedbackLink.value = await $fetch<SentFeedbackLink>(`/api/admin/rentals/${rental.uuid}/feedback`, {
      method: 'POST',
      body: { earnsReward: feedbackEarns.value },
    })
    await refresh()
  }
  catch (caught) {
    const payload = typeof caught === 'object' && caught && 'data' in caught
      ? (caught as { data?: { message?: string } }).data
      : null
    toast.add({ title: payload?.message || 'We could not create the feedback link.', color: 'error' })
  }
  finally {
    feedbackBusy.value = ''
  }
}

async function copyFeedbackLink() {
  if (!feedbackLink.value) {
    return
  }
  try {
    await navigator.clipboard.writeText(feedbackLink.value.feedbackUrl)
    toast.add({ title: 'Feedback link copied', color: 'success' })
  }
  catch {
    toast.add({ title: 'Select the link and copy it manually.', color: 'error' })
  }
}

async function removeRental(uuid: string) {
  deletePending.value = true
  try {
    await $fetch(`/api/admin/rentals/${uuid}`, { method: 'DELETE' })
    toast.add({ title: 'Rental deleted', color: 'success' })
    deleteCode.value = ''
    await refresh()
  }
  catch (caught) {
    const payload = typeof caught === 'object' && caught && 'data' in caught
      ? (caught as { data?: { message?: string } }).data
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
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div class="min-w-0">
        <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
          Operations
        </p>
        <h2 class="mt-2 text-2xl font-medium text-stone-900">
          Rentals
        </h2>
        <p class="mt-1 text-sm text-stone-600">
          Create a booking for a client, send the waiver link, finish a draft, or confirm a request.
        </p>
      </div>
      <UButton
        to="/admin/rentals/new"
        icon="i-lucide-plus"
        class="w-full justify-center sm:w-auto"
      >
        New booking
      </UButton>
    </div>

    <form
      class="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-2"
      method="get"
      @submit.prevent
    >
      <input
        v-model="searchInput"
        class="rounded-md border border-stone-200 px-3 py-2 text-sm"
        placeholder="Search code"
      >
      <select
        v-model="status"
        class="rounded-md border border-stone-200 px-3 py-2 text-sm"
      >
        <option value="">
          All statuses
        </option>
        <option
          v-for="item in RENTAL_STATUSES"
          :key="item"
          :value="item"
        >
          {{ item.replaceAll('_', ' ') }}
        </option>
      </select>
    </form>

    <AdminNotice
      v-if="unavailable"
      title="Rentals are not connected"
      description="Add live Supabase credentials to load rental requests."
    />

    <AdminNotice
      v-else-if="error"
      title="Rentals could not be loaded"
      description="Refresh the page, then try again."
      tone="alert"
    />

    <div
      v-else-if="pending && !data"
      class="space-y-3"
    >
      <USkeleton class="h-20 w-full" />
      <USkeleton class="h-20 w-full" />
    </div>

    <AdminNotice
      v-else-if="!data?.items.length"
      title="No rentals"
      description="Customer requests will appear here."
    />

    <ul
      v-else
      class="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white"
    >
      <li
        v-for="rental in data.items"
        :key="rental.uuid"
        class="flex flex-col gap-3 px-4 py-4 lg:flex-row lg:items-center"
      >
        <NuxtLink
          :to="`/admin/rentals/${rental.code}`"
          class="grid min-w-0 flex-1 gap-2 hover:opacity-80 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1.2fr)_auto_auto] lg:items-center lg:gap-3"
        >
          <div class="min-w-0">
            <div class="flex items-start justify-between gap-3">
              <p class="font-medium text-stone-900">
                {{ rental.items[0]?.product.name || rental.code }}
              </p>
              <StatusBadge
                class="shrink-0 lg:hidden"
                :status="rental.status"
              />
            </div>
            <p class="mt-1 text-sm break-words text-stone-500">
              {{ rental.code }}
              · {{ rental.customer ? `${rental.customer.firstName} ${rental.customer.lastName}` : 'Customer' }}
              <template v-if="rental.commissioner">
                · Commissioner {{ rental.commissioner.firstName }} {{ rental.commissioner.lastName }}
              </template>
            </p>
          </div>
          <p class="text-sm leading-5 text-stone-600">
            <span class="whitespace-nowrap">{{ formatBookingDateRange(rental.startsOn, rental.endsOn) }}</span>
            <span class="whitespace-nowrap"> · {{ formatPickupClock(rental.pickupTime) }}</span>
          </p>
          <span
            class="text-sm font-medium tabular-nums text-stone-900"
            title="Actual sale: rent after discounts, minus commissions and unpaid extensions. Deposit not included."
          >{{ formatMoney(rental.actualSale ?? rental.totalAmount) }}</span>
          <StatusBadge
            class="hidden shrink-0 lg:inline-flex"
            :status="rental.status"
          />
        </NuxtLink>
        <div class="flex flex-wrap gap-2 lg:shrink-0 lg:justify-end">
          <NuxtLink
            v-if="rental.feedback?.status === 'submitted'"
            :to="`/admin/rentals/${rental.code}#feedback`"
            class="inline-flex min-w-[8rem] flex-1 items-center justify-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 lg:flex-none"
            :title="`Customer rated this booking ${rental.feedback.averageRating?.toFixed(1)} of 5`"
          >
            <svg
              viewBox="0 0 24 24"
              class="size-4 fill-amber-400"
              aria-hidden="true"
            ><path d="M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.53L12 17.5l-5.87 3.07 1.12-6.53L2.5 9.41l6.56-.95L12 2.5z" /></svg>
            {{ rental.feedback.averageRating?.toFixed(1) }} feedback
          </NuxtLink>
          <UButton
            v-else-if="rental.feedback"
            color="neutral"
            variant="outline"
            size="sm"
            icon="i-lucide-star"
            class="min-w-[8rem] flex-1 justify-center lg:flex-none"
            :loading="feedbackBusy === rental.uuid"
            :disabled="Boolean(feedbackBusy) && feedbackBusy !== rental.uuid"
            :title="rental.feedback.status === 'sent' ? 'A link was sent. Create a new one (the old link stops working).' : 'Create a feedback link for this customer'"
            @click="openFeedback(rental)"
          >
            {{ rental.feedback.status === 'sent' ? 'New feedback link' : 'Feedback link' }}
          </UButton>
          <UButton
            v-if="canOpenAdminContinue(rental)"
            :to="`/admin/rentals/${rental.uuid}/continue`"
            color="neutral"
            variant="outline"
            size="sm"
            class="min-w-[8rem] flex-1 justify-center lg:flex-none"
          >
            {{ canModifyAdminRental(rental) && rental.status !== 'draft' ? 'Edit' : 'Continue' }}
          </UButton>
          <template v-if="deleteCode === rental.code">
            <UButton
              color="error"
              size="sm"
              class="min-w-[8rem] flex-1 justify-center lg:flex-none"
              :loading="deletePending"
              @click="removeRental(rental.uuid)"
            >
              Confirm
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              class="min-w-[8rem] flex-1 justify-center lg:flex-none"
              :disabled="deletePending"
              @click="deleteCode = ''"
            >
              Cancel
            </UButton>
          </template>
          <UButton
            v-else
            color="error"
            variant="ghost"
            size="sm"
            class="min-w-[8rem] flex-1 justify-center lg:flex-none"
            @click="deleteCode = rental.code"
          >
            Delete
          </UButton>
        </div>
      </li>
    </ul>

    <UModal
      v-model:open="feedbackOpen"
      :title="feedbackTarget ? `Feedback link for ${feedbackTarget.code}` : 'Feedback link'"
      :description="!feedbackLink
        ? 'Choose if this feedback earns the thank-you voucher, then create the link.'
        : feedbackLink.sent ? 'We emailed this link to the customer. You can also copy it and send it on Messenger.' : 'No email was sent. Copy this link and send it to the customer.'"
      :ui="{ content: 'sm:max-w-lg' }"
    >
      <template #body>
        <div
          v-if="!feedbackLink"
          class="space-y-4"
        >
          <label class="flex items-start gap-3 rounded-lg border border-stone-200 p-3 text-sm">
            <UCheckbox
              v-model="feedbackEarns"
              :disabled="Boolean(feedbackBusy)"
              class="mt-0.5"
            />
            <span>
              <span class="block font-medium text-stone-900">Earns the thank-you voucher</span>
              <span class="block text-stone-600">If the customer rates every question and leaves a comment, they get the voucher set in Vouchers (while codes last). Turn off to only collect feedback.</span>
            </span>
          </label>
          <p
            v-if="feedbackTarget?.feedback?.status === 'sent'"
            class="text-xs text-amber-700"
          >
            A link was already sent. Creating a new one turns off the old link.
          </p>
          <div class="flex justify-end gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              :disabled="Boolean(feedbackBusy)"
              @click="feedbackOpen = false"
            >
              Cancel
            </UButton>
            <UButton
              icon="i-lucide-send"
              :loading="Boolean(feedbackBusy)"
              @click="createFeedbackLink"
            >
              Create link
            </UButton>
          </div>
        </div>
        <div
          v-else
          class="space-y-3"
        >
          <div class="flex gap-2">
            <UInput
              :model-value="feedbackLink.feedbackUrl"
              readonly
              class="min-w-0 flex-1"
              @focus="($event.target as HTMLInputElement).select()"
            />
            <UButton
              icon="i-lucide-copy"
              @click="copyFeedbackLink"
            >
              Copy
            </UButton>
          </div>
          <p class="text-xs text-stone-500">
            The link works for 30 days. Only the customer with this link can answer, once. {{ feedbackLink.earnsReward ? 'This feedback earns the thank-you voucher.' : 'This feedback does not earn a voucher.' }}
          </p>
        </div>
      </template>
    </UModal>

    <div
      v-if="totalPages > 1"
      class="flex flex-wrap justify-end gap-2"
    >
      <UButton
        color="neutral"
        variant="outline"
        :disabled="page <= 1"
        @click="page -= 1"
      >
        Previous
      </UButton>
      <UButton
        color="neutral"
        variant="outline"
        :disabled="page >= totalPages"
        @click="page += 1"
      >
        Next
      </UButton>
    </div>
  </div>
</template>
