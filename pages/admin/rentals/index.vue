<script setup lang="ts">
import type { PublicRental, RentalListResponse } from '~/types/rental'
import type { SentFeedbackLink } from '~/types/feedback'
import type { AdminAnalytics } from '~/types/analytics'
import { ADMIN_RENTAL_GROUPS, RENTAL_STATUSES } from '~/utils/constants'
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

const route = useRoute()
const searchInput = ref('')
const search = refDebounced(searchInput, 300)
const initialStatus = typeof route.query.status === 'string' && (RENTAL_STATUSES as readonly string[]).includes(route.query.status) ? route.query.status : ''
const status = ref(initialStatus)
const initialGroup = !initialStatus && typeof route.query.group === 'string' && (ADMIN_RENTAL_GROUPS as readonly string[]).includes(route.query.group) ? route.query.group : ''
const group = ref(initialGroup)
const { data: analytics } = useFetch<AdminAnalytics>('/api/admin/analytics', { lazy: true, server: false })
const kpis = computed(() => analytics.value?.kpis)
const count = (value?: number) => value === undefined ? '—' : String(value)

interface RentalTile {
  key: string
  kind: 'status' | 'group'
  label: string
  value?: number
  hint: string
  icon: string
}

const tiles = computed<RentalTile[]>(() => [
  { key: 'pending', kind: 'status', label: 'Pending', value: kpis.value?.pendingRentals, hint: 'Waiting for approval', icon: 'i-lucide-hourglass' },
  { key: 'upcoming', kind: 'group', label: 'Upcoming', value: kpis.value?.upcomingRentals, hint: 'Paid, pickup still ahead', icon: 'i-lucide-calendar-clock' },
  { key: 'active', kind: 'group', label: 'Active', value: kpis.value?.activeRentals, hint: 'Out with customers', icon: 'i-lucide-activity' },
  { key: 'overdue', kind: 'status', label: 'Overdue', value: kpis.value?.overdueRentals, hint: 'Past the return time', icon: 'i-lucide-alarm-clock' },
  { key: 'done', kind: 'group', label: 'Done', value: kpis.value?.doneRentals, hint: 'Returned and completed', icon: 'i-lucide-circle-check' },
  { key: 'cancelled', kind: 'group', label: 'Cancelled', value: kpis.value?.cancelledRentals, hint: 'Cancelled or rejected', icon: 'i-lucide-circle-x' },
])

function isTileOn(tile: RentalTile) {
  return tile.kind === 'group' ? group.value === tile.key : !group.value && status.value === tile.key
}

function toggleTile(tile: RentalTile) {
  const on = isTileOn(tile)
  group.value = !on && tile.kind === 'group' ? tile.key : ''
  status.value = !on && tile.kind === 'status' ? tile.key : ''
}

/** Rows get a tag only while upcoming or active. Done and cancelled rows already say so in their status. */
function groupTag(rental: PublicRental) {
  if (rental.group === 'upcoming') {
    return 'upcoming'
  }
  return rental.group === 'active' && rental.status !== 'active' ? 'active' : ''
}

const filterLabel = computed(() => {
  if (group.value) {
    return `Showing: ${group.value}`
  }
  return status.value ? `Status: ${status.value.replaceAll('_', ' ')}` : ''
})
const page = ref(1)
const { formatMoney } = useCurrency()

const query = computed(() => ({
  search: search.value || undefined,
  status: status.value || undefined,
  group: group.value || undefined,
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

watch(status, (value) => {
  if (value) {
    group.value = ''
  }
})

watch([search, status, group], () => {
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
    <AdminPageHeader
      eyebrow="Operations"
      title="Rentals"
      description="Create a booking for a client, send the waiver link, finish a draft, or confirm a request."
    >
      <template #actions>
        <UButton
          to="/admin/rentals/new"
          icon="i-lucide-plus"
        >
          New booking
        </UButton>
      </template>
    </AdminPageHeader>

    <AdminBento :columns="4">
      <button
        v-for="tile in tiles"
        :key="tile.key"
        type="button"
        class="col-span-1 flex min-w-0 flex-col justify-between gap-3 rounded-2xl border p-4 text-left transition-colors sm:p-5"
        :class="isTileOn(tile)
          ? 'border-transparent bg-[#12201a] text-white'
          : tile.key === 'overdue' && (tile.value ?? 0) > 0
            ? 'border-amber-200 bg-amber-50 text-stone-900 hover:border-amber-300'
            : 'border-stone-200 bg-white text-stone-900 hover:border-stone-300'"
        :aria-pressed="isTileOn(tile)"
        @click="toggleTile(tile)"
      >
        <span class="flex w-full items-start justify-between gap-2">
          <span
            class="text-[11px] font-medium uppercase tracking-wider"
            :class="isTileOn(tile) ? 'text-white/60' : 'text-stone-500'"
          >{{ tile.label }}</span>
          <UIcon
            :name="tile.icon"
            class="size-4 shrink-0"
            :class="isTileOn(tile) ? 'text-white/60' : 'text-stone-400'"
          />
        </span>
        <span>
          <span class="block text-xl font-semibold tabular-nums sm:text-2xl">{{ count(tile.value) }}</span>
          <span
            class="mt-1 block text-xs"
            :class="isTileOn(tile) ? 'text-white/60' : 'text-stone-500'"
          >{{ isTileOn(tile) ? 'Showing these · tap to clear' : tile.hint }}</span>
        </span>
      </button>
      <AdminStat
        wide
        tone="accent"
        label="All rentals"
        icon="i-lucide-clipboard-list"
        :value="String(data?.total ?? '—')"
        :hint="filterLabel || (search ? `Matching \u201C${search}\u201D` : 'All statuses')"
      />
    </AdminBento>

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
      :title="filterLabel || search ? 'No rentals match' : 'No rentals'"
      :description="filterLabel || search ? 'Clear the filter or search to see all rentals.' : 'Customer requests will appear here.'"
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
              <span class="flex shrink-0 flex-wrap justify-end gap-1.5 lg:hidden">
                <StatusBadge
                  v-if="groupTag(rental)"
                  :status="groupTag(rental)"
                />
                <StatusBadge :status="rental.status" />
              </span>
            </div>
            <p class="mt-1 text-sm break-words text-stone-500">
              {{ rental.code }}
              · {{ rental.customer ? `${rental.customer.firstName} ${rental.customer.lastName}` : 'Customer' }}
              <template v-if="rental.commissioner">
                · Commissioner {{ rental.commissioner.firstName }} {{ rental.commissioner.lastName }}
              </template>
            </p>
            <p
              v-if="rental.paymentBalance && rental.paymentBalance.balanceDue > 0"
              class="mt-1 text-xs font-medium text-amber-800"
            >
              Balance unpaid · {{ formatMoney(rental.paymentBalance.balanceDue) }}
            </p>
            <p
              v-else-if="rental.paymentBalance && rental.paymentBalance.refundDue > 0"
              class="mt-1 text-xs font-medium text-sky-800"
            >
              To refund · {{ formatMoney(rental.paymentBalance.refundDue) }}
            </p>
          </div>
          <p class="text-sm leading-5 text-stone-600">
            <span>{{ formatBookingDateRange(rental.startsOn, rental.endsOn) }}</span>
            <span> · {{ formatPickupClock(rental.pickupTime) }}</span>
          </p>
          <span
            class="text-sm font-medium tabular-nums text-stone-900"
            title="Actual sale: rent after discounts, minus commissions, unpaid extensions and unpaid balances. Deposit not included."
          >{{ formatMoney(rental.actualSale ?? rental.totalAmount) }}</span>
          <span class="hidden shrink-0 items-center gap-1.5 lg:flex">
            <StatusBadge
              v-if="groupTag(rental)"
              :status="groupTag(rental)"
            />
            <StatusBadge :status="rental.status" />
          </span>
        </NuxtLink>
        <div class="flex flex-wrap gap-2 lg:shrink-0 lg:justify-end">
          <NuxtLink
            v-if="rental.feedback?.status === 'submitted'"
            :to="`/admin/rentals/${rental.code}#feedback`"
            class="inline-flex min-w-0 flex-1 basis-36 items-center justify-center gap-1.5 rounded-md bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-800 hover:bg-amber-100 lg:flex-none"
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
            class="min-w-0 flex-1 basis-36 justify-center lg:flex-none"
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
            class="min-w-0 flex-1 basis-36 justify-center lg:flex-none"
          >
            {{ canModifyAdminRental(rental) && rental.status !== 'draft' ? 'Edit' : 'Continue' }}
          </UButton>
          <template v-if="deleteCode === rental.code">
            <UButton
              color="error"
              size="sm"
              class="min-w-0 flex-1 basis-36 justify-center lg:flex-none"
              :loading="deletePending"
              @click="removeRental(rental.uuid)"
            >
              Confirm
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              size="sm"
              class="min-w-0 flex-1 basis-36 justify-center lg:flex-none"
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
            class="min-w-0 flex-1 basis-36 justify-center lg:flex-none"
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
          <div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
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
          <div class="flex flex-col gap-2 sm:flex-row">
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
