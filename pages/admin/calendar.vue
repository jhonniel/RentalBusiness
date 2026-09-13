<script setup lang="ts">
import type { AdminCalendar } from '~/types/calendar'
import { CALENDAR_RENTAL_STATUSES } from '~/utils/constants'
import { calendarAgenda, eventsOnDate, monthCells, monthKey, shiftMonth } from '~/utils/calendar'
import { calendarDateInZone, formatBusinessDate } from '~/utils/datetime'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Calendar',
  path: '/admin/calendar',
})

const month = ref(monthKey())
const status = ref('')
const today = calendarDateInZone()
const weekdayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const query = computed(() => ({
  month: month.value,
  status: status.value || undefined,
}))

const { data, error, pending } = await useFetch<AdminCalendar>('/api/admin/calendar', {
  query,
  watch: [query],
})

const unavailable = computed(() => error.value?.statusCode === 503)
const items = computed(() => data.value?.items ?? [])
const cells = computed(() => monthCells(month.value))
const agenda = computed(() => calendarAgenda(items.value, month.value))
const monthLabel = computed(() => formatBusinessDate(`${month.value}-01`, {
  month: 'long',
  year: 'numeric',
}))

function dayNumber(date: string) {
  return Number(date.slice(8))
}
</script>

<template>
  <div class="mx-auto max-w-6xl space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
          Operations
        </p>
        <h2 class="mt-2 text-2xl font-medium text-stone-900">
          Calendar
        </h2>
        <p class="mt-1 text-sm text-stone-600">
          Rentals that overlap this month in Asia/Manila. Draft, cancelled, and rejected requests stay off the board.
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
        <UButton
          color="neutral"
          variant="outline"
          @click="month = shiftMonth(month, -1)"
        >
          Previous
        </UButton>
        <p class="min-w-36 text-center text-sm font-medium text-stone-900">
          {{ monthLabel }}
        </p>
        <UButton
          color="neutral"
          variant="outline"
          @click="month = shiftMonth(month, 1)"
        >
          Next
        </UButton>
      </div>
    </div>

    <form
      class="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:max-w-xs"
      method="get"
      @submit.prevent
    >
      <label class="block text-sm">
        <span class="mb-1 block text-xs font-medium text-stone-600">Status</span>
        <select
          v-model="status"
          class="w-full rounded-md border border-stone-200 px-3 py-2 text-sm capitalize"
        >
          <option value="">
            All visible
          </option>
          <option
            v-for="item in CALENDAR_RENTAL_STATUSES"
            :key="item"
            :value="item"
          >
            {{ item.replaceAll('_', ' ') }}
          </option>
        </select>
      </label>
    </form>

    <AdminNotice
      v-if="unavailable"
      title="Calendar is not connected"
      description="Add live Supabase credentials to load rental dates."
    />

    <div
      v-else-if="pending && !data"
      class="space-y-3"
    >
      <USkeleton class="h-72 w-full" />
    </div>

    <template v-else>
      <AdminNotice
        v-if="!items.length"
        title="No rentals this month"
        description="Requests that overlap these dates will appear here."
      />

      <div
        v-else
        class="hidden overflow-hidden rounded-xl border border-stone-200 bg-white md:block"
      >
        <div class="grid grid-cols-7 border-b border-stone-100 bg-stone-50 text-xs font-medium text-stone-500">
          <p
            v-for="label in weekdayLabels"
            :key="label"
            class="px-3 py-2"
          >
            {{ label }}
          </p>
        </div>
        <div class="grid grid-cols-7">
          <div
            v-for="(date, index) in cells"
            :key="date || `empty-${index}`"
            class="min-h-28 border-b border-r border-stone-100 p-2 last:border-r-0"
            :class="date === today ? 'bg-lumen-50/60' : 'bg-white'"
          >
            <template v-if="date">
              <p
                class="text-xs font-medium"
                :class="date === today ? 'text-lumen-800' : 'text-stone-500'"
              >
                {{ dayNumber(date) }}
              </p>
              <ul class="mt-2 space-y-1">
                <li
                  v-for="item in eventsOnDate(items, date)"
                  :key="item.uuid"
                >
                  <NuxtLink
                    :to="`/admin/rentals/${item.code}`"
                    class="block rounded-md px-1.5 py-1 hover:bg-stone-50"
                  >
                    <p class="truncate text-xs font-medium text-stone-900">
                      {{ item.productName }}
                    </p>
                    <p class="truncate text-[11px] text-stone-500">
                      {{ item.code }}
                    </p>
                  </NuxtLink>
                </li>
              </ul>
            </template>
          </div>
        </div>
      </div>

      <div
        v-if="agenda.length"
        class="space-y-3 md:hidden"
      >
        <article
          v-for="day in agenda"
          :key="day.date"
          class="rounded-xl border border-stone-200 bg-white p-4"
        >
          <p class="text-sm font-medium text-stone-900">
            {{ formatBusinessDate(day.date) }}
          </p>
          <ul class="mt-3 space-y-3">
            <li
              v-for="item in day.items"
              :key="item.uuid"
            >
              <NuxtLink
                :to="`/admin/rentals/${item.code}`"
                class="block"
              >
                <p class="font-medium text-stone-900">
                  {{ item.productName }}
                </p>
                <p class="mt-1 text-sm break-words text-stone-500">
                  {{ item.code }}
                  <template v-if="item.customerName">
                    · {{ item.customerName }}
                  </template>
                  · {{ formatBusinessDate(item.startsOn) }} – {{ formatBusinessDate(item.endsOn) }}
                </p>
                <div class="mt-2">
                  <StatusBadge :status="item.status" />
                </div>
              </NuxtLink>
            </li>
          </ul>
        </article>
      </div>
    </template>
  </div>
</template>
