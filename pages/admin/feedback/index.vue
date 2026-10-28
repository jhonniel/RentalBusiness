<script setup lang="ts">
import FeedbackStarRating from '~/components/feedback/FeedbackStarRating.vue'
import AdminFeedbackReward from '~/components/admin/AdminFeedbackReward.vue'
import type { AdminFeedbackList, AdminFeedbackListItem } from '~/types/feedback'
import { formatBusinessDateTime } from '~/utils/datetime'
import { FEEDBACK_RATING_LABELS, OVERALL_EXPERIENCE } from '~/utils/feedback'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Feedback',
  path: '/admin/feedback',
})

const searchInput = ref('')
const search = refDebounced(searchInput, 300)
const device = ref('')
const status = ref<'submitted' | 'sent' | 'expired' | 'all'>('submitted')
const rating = ref('')
const page = ref(1)
const expanded = ref<string | null>(null)

const query = computed(() => ({
  search: search.value || undefined,
  device: device.value || undefined,
  status: status.value,
  rating: rating.value || undefined,
  page: page.value,
  pageSize: 20,
}))

watch([search, device, status, rating], () => {
  page.value = 1
})

const { data, error, pending } = await useFetch<AdminFeedbackList>('/api/admin/feedback', {
  query,
  watch: [query],
})

const unavailable = computed(() => error.value?.statusCode === 503)
const summary = computed(() => data.value?.summary)
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / 20)))
const starRows = computed(() => {
  const stars = summary.value?.stars
  const total = summary.value?.responses || 0
  return ([5, 4, 3, 2, 1] as const).map(star => ({
    star,
    count: stars?.[star] ?? 0,
    percent: total ? Math.round(((stars?.[star] ?? 0) / total) * 100) : 0,
  }))
})

const STATUS_LABELS: Record<AdminFeedbackListItem['status'], { label: string, class: string }> = {
  submitted: { label: 'Answered', class: 'bg-emerald-50 text-emerald-700' },
  sent: { label: 'Waiting', class: 'bg-sky-50 text-sky-700' },
  expired: { label: 'Expired', class: 'bg-amber-50 text-amber-700' },
  not_sent: { label: 'Not sent', class: 'bg-stone-100 text-stone-600' },
}

function groups(item: AdminFeedbackListItem) {
  const map = new Map<string, AdminFeedbackListItem['answers']>()
  for (const answer of item.answers) {
    const title = answer.product ?? OVERALL_EXPERIENCE
    map.set(title, [...(map.get(title) ?? []), answer])
  }
  return [...map.entries()].map(([title, answers]) => ({ title, answers }))
}
</script>

<template>
  <div class="w-full space-y-6">
    <div>
      <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
        Customers
      </p>
      <h2 class="mt-2 text-2xl font-medium text-stone-900">
        Feedback
      </h2>
      <p class="mt-1 text-sm text-stone-600">
        Star ratings and comments customers sent after their booking. Send a link from Rentals or from a booking once it is returned or done.
      </p>
    </div>

    <AdminNotice
      v-if="unavailable"
      title="Feedback is not connected"
      description="Add live Supabase credentials to load feedback."
    />

    <AdminNotice
      v-else-if="data && !data.ready"
      title="Paste the feedback SQL to turn this on"
      description="Run supabase/migrations/20261028000000_rental_feedback.sql in the Supabase SQL editor, then send links from Rentals."
    />

    <template v-else-if="data && summary">
      <AdminFeedbackReward compact />

      <div class="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-xl border border-stone-200 bg-white p-4">
          <p class="text-xs font-medium uppercase tracking-wider text-stone-500">
            Average rating
          </p>
          <div class="mt-2 flex items-center gap-3">
            <p class="text-3xl font-semibold tabular-nums text-stone-900">
              {{ summary.averageRating?.toFixed(1) ?? '—' }}
            </p>
            <FeedbackStarRating
              :model-value="summary.averageRating ?? 0"
              read-only
              size="sm"
              label="Average rating"
            />
          </div>
        </div>
        <div class="rounded-xl border border-stone-200 bg-white p-4">
          <p class="text-xs font-medium uppercase tracking-wider text-stone-500">
            Responses
          </p>
          <p class="mt-2 text-3xl font-semibold tabular-nums text-stone-900">
            {{ summary.responses }}
          </p>
        </div>
        <div class="rounded-xl border border-stone-200 bg-white p-4">
          <p class="text-xs font-medium uppercase tracking-wider text-stone-500">
            Waiting for an answer
          </p>
          <p class="mt-2 text-3xl font-semibold tabular-nums text-stone-900">
            {{ summary.waiting }}
          </p>
          <p
            v-if="summary.expired"
            class="mt-1 text-xs text-amber-700"
          >
            {{ summary.expired }} expired
          </p>
        </div>
        <div class="rounded-xl border border-stone-200 bg-white p-4">
          <p class="text-xs font-medium uppercase tracking-wider text-stone-500">
            Response rate
          </p>
          <p class="mt-2 text-3xl font-semibold tabular-nums text-stone-900">
            {{ summary.responseRate === null ? '—' : `${summary.responseRate}%` }}
          </p>
        </div>
      </div>

      <div class="grid gap-4 lg:grid-cols-2">
        <section class="rounded-xl border border-stone-200 bg-white p-5">
          <h3 class="text-sm font-medium text-stone-900">
            Ratings by device
          </h3>
          <p
            v-if="!summary.devices.length"
            class="mt-3 text-sm text-stone-500"
          >
            No ratings yet.
          </p>
          <ul
            v-else
            class="mt-3 space-y-3"
          >
            <li
              v-for="item in summary.devices"
              :key="item.name"
            >
              <div class="flex items-center justify-between gap-3 text-sm">
                <span class="min-w-0 truncate text-stone-700">{{ item.name }}</span>
                <span class="flex shrink-0 items-center gap-2">
                  <FeedbackStarRating
                    :model-value="item.averageRating"
                    read-only
                    size="sm"
                    :label="item.name"
                  />
                  <span class="w-10 text-right font-medium tabular-nums text-stone-900">{{ item.averageRating.toFixed(1) }}</span>
                </span>
              </div>
              <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-stone-100">
                <div
                  class="h-full rounded-full bg-amber-400 transition-[width] duration-700"
                  :style="{ width: `${(item.averageRating / 5) * 100}%` }"
                />
              </div>
              <p class="mt-1 text-xs text-stone-500">
                {{ item.responses }} response{{ item.responses === 1 ? '' : 's' }}
              </p>
            </li>
          </ul>
        </section>

        <section class="rounded-xl border border-stone-200 bg-white p-5">
          <h3 class="text-sm font-medium text-stone-900">
            Star breakdown
          </h3>
          <ul class="mt-3 space-y-2">
            <li
              v-for="row in starRows"
              :key="row.star"
              class="flex items-center gap-3 text-sm"
            >
              <button
                type="button"
                class="w-14 shrink-0 text-left text-stone-600 hover:text-stone-900"
                :class="rating === String(row.star) ? 'font-semibold text-stone-900' : ''"
                @click="rating = rating === String(row.star) ? '' : String(row.star)"
              >
                {{ row.star }} star{{ row.star === 1 ? '' : 's' }}
              </button>
              <div class="h-2 flex-1 overflow-hidden rounded-full bg-stone-100">
                <div
                  class="h-full rounded-full bg-amber-400 transition-[width] duration-700"
                  :style="{ width: `${row.percent}%` }"
                />
              </div>
              <span class="w-8 shrink-0 text-right tabular-nums text-stone-600">{{ row.count }}</span>
            </li>
          </ul>
          <p class="mt-3 text-xs text-stone-500">
            Based on each customer's average. Tap a row to filter.
          </p>
        </section>
      </div>

      <form
        class="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4"
        @submit.prevent
      >
        <input
          v-model="searchInput"
          class="rounded-md border border-stone-200 px-3 py-2 text-sm"
          placeholder="Search booking, customer, or comment"
        >
        <select
          v-model="device"
          class="rounded-md border border-stone-200 px-3 py-2 text-sm"
        >
          <option value="">
            All devices
          </option>
          <option
            v-for="name in data.devices"
            :key="name"
            :value="name"
          >
            {{ name }}
          </option>
        </select>
        <select
          v-model="status"
          class="rounded-md border border-stone-200 px-3 py-2 text-sm"
        >
          <option value="submitted">
            Answered
          </option>
          <option value="sent">
            Waiting for an answer
          </option>
          <option value="expired">
            Expired links
          </option>
          <option value="all">
            All links
          </option>
        </select>
        <select
          v-model="rating"
          class="rounded-md border border-stone-200 px-3 py-2 text-sm"
        >
          <option value="">
            Any rating
          </option>
          <option
            v-for="star in [5, 4, 3, 2, 1]"
            :key="star"
            :value="String(star)"
          >
            {{ star }} star{{ star === 1 ? '' : 's' }}
          </option>
        </select>
      </form>

      <div
        v-if="pending && !data.items.length"
        class="space-y-3"
      >
        <USkeleton class="h-20 w-full" />
        <USkeleton class="h-20 w-full" />
      </div>

      <AdminNotice
        v-else-if="!data.items.length"
        title="No feedback here yet"
        :description="status === 'submitted' ? 'When a customer answers a feedback link, it shows up here.' : 'Try another filter.'"
      />

      <ul
        v-else
        class="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white"
      >
        <li
          v-for="item in data.items"
          :key="item.uuid"
          class="px-4 py-4"
        >
          <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <NuxtLink
                  :to="`/admin/rentals/${item.rentalCode}#feedback`"
                  class="font-medium text-stone-900 hover:underline"
                >
                  {{ item.rentalCode }}
                </NuxtLink>
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="STATUS_LABELS[item.status].class"
                >{{ STATUS_LABELS[item.status].label }}</span>
              </div>
              <p class="mt-0.5 text-sm text-stone-600">
                {{ item.customerName }} · {{ item.products.join(', ') || 'Rental' }}
              </p>
              <p class="mt-0.5 text-xs text-stone-500">
                {{ item.submittedAt ? `Answered ${formatBusinessDateTime(item.submittedAt)}` : `Link sent ${formatBusinessDateTime(item.sentAt)}` }}
              </p>
            </div>
            <div
              v-if="item.averageRating !== null"
              class="flex shrink-0 items-center gap-2"
            >
              <FeedbackStarRating
                :model-value="item.averageRating"
                read-only
                size="sm"
                label="Customer average"
              />
              <span class="text-lg font-semibold tabular-nums text-stone-900">{{ item.averageRating.toFixed(1) }}</span>
            </div>
          </div>

          <p
            v-if="item.rewardCode"
            class="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800"
          >
            <UIcon
              name="i-lucide-ticket"
              class="size-3.5"
            />
            Thank-you voucher {{ item.rewardCode }}
          </p>
          <p
            v-if="item.comment"
            class="mt-3 whitespace-pre-line rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700"
          >
            “{{ item.comment }}”
          </p>

          <template v-if="item.answers.length">
            <UButton
              color="neutral"
              variant="ghost"
              size="xs"
              class="mt-2 -ml-2"
              :icon="expanded === item.uuid ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'"
              @click="expanded = expanded === item.uuid ? null : item.uuid"
            >
              {{ expanded === item.uuid ? 'Hide ratings' : `Show ${item.answers.length} ratings` }}
            </UButton>
            <div
              v-if="expanded === item.uuid"
              class="mt-2 grid gap-4 md:grid-cols-2"
            >
              <div
                v-for="group in groups(item)"
                :key="group.title"
              >
                <p class="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  {{ group.title }}
                </p>
                <ul class="mt-1 divide-y divide-stone-100">
                  <li
                    v-for="answer in group.answers"
                    :key="answer.key"
                    class="flex items-center justify-between gap-3 py-1.5 text-sm"
                  >
                    <span class="text-stone-700">{{ answer.text }}</span>
                    <span
                      class="flex shrink-0 items-center gap-1.5"
                      :title="FEEDBACK_RATING_LABELS[answer.rating]"
                    >
                      <FeedbackStarRating
                        :model-value="answer.rating"
                        read-only
                        size="sm"
                        :label="answer.text"
                      />
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </template>
        </li>
      </ul>

      <div
        v-if="totalPages > 1"
        class="flex flex-wrap items-center justify-end gap-2"
      >
        <span class="text-sm text-stone-500">Page {{ page }} of {{ totalPages }}</span>
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
    </template>
  </div>
</template>
