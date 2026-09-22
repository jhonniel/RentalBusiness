<script setup lang="ts">
import type { ProductListResponse } from '~/types/catalog'
import type { AdminCalendar } from '~/types/calendar'
import { CALENDAR_RENTAL_STATUSES, canBlockProductDates } from '~/utils/constants'
import {
  applyCalendarPick,
  blocksOnDate,
  calendarAgenda,
  eventsOnDate,
  isDateInRange,
  monthCells,
  monthKey,
  shiftMonth,
} from '~/utils/calendar'
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
const draftStartsOn = ref('')
const draftEndsOn = ref('')
const viewedDate = ref('')
const detailsOpen = ref(false)

const query = computed(() => ({
  month: month.value,
  status: status.value || undefined,
}))

const { data, error, pending, refresh } = await useFetch<AdminCalendar>('/api/admin/calendar', {
  query,
  watch: [query],
})
const { data: catalog } = await useFetch<ProductListResponse>('/api/admin/products', {
  query: { pageSize: 50 },
})

const unavailable = computed(() => error.value?.statusCode === 503)
const items = computed(() => data.value?.items ?? [])
const blockedDates = computed(() => data.value?.blockedDates ?? [])
const products = computed(() => (
  (catalog.value?.items ?? [])
    .filter(item => canBlockProductDates(item.status))
    .map(item => ({ uuid: item.uuid, name: item.name }))
))
const cells = computed(() => monthCells(month.value))
const agenda = computed(() => calendarAgenda(items.value, month.value, blockedDates.value))
const monthLabel = computed(() => formatBusinessDate(`${month.value}-01`, {
  month: 'long',
  year: 'numeric',
}))
function dayNumber(date: string) {
  return Number(date.slice(8))
}

const viewedItems = computed(() => viewedDate.value ? eventsOnDate(items.value, viewedDate.value) : [])
const viewedBlocks = computed(() => viewedDate.value ? blocksOnDate(blockedDates.value, viewedDate.value) : [])
const canBlockViewedDay = computed(() => Boolean(viewedDate.value && viewedDate.value >= today))

function openDay(date: string) {
  viewedDate.value = date
  detailsOpen.value = true
}

function pickDay(date: string) {
  const next = applyCalendarPick(date, draftStartsOn.value, draftEndsOn.value, today)
  draftStartsOn.value = next.startsOn
  draftEndsOn.value = next.endsOn
  detailsOpen.value = false
}

function dayIsViewed(date: string) {
  return viewedDate.value === date
}

function dayIsPast(date: string) {
  return date < today
}

function dayIsSelected(date: string) {
  return isDateInRange(date, draftStartsOn.value, draftEndsOn.value)
}

function onBlockSaved() {
  draftStartsOn.value = ''
  draftEndsOn.value = ''
  return refresh()
}

watch(month, () => {
  detailsOpen.value = false
  viewedDate.value = ''
})

watch(detailsOpen, (open) => {
  if (!open) {
    viewedDate.value = ''
  }
})
</script>

<template>
  <div class="w-full space-y-6">
    <div class="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
          Operations
        </p>
        <h2 class="mt-2 text-2xl font-medium text-stone-900">
          Calendar
        </h2>
        <p class="mt-1 text-sm text-stone-600">
          Rentals and blocked dates for this month in Asia/Manila. Click a day to view details. Draft, cancelled, and rejected requests stay off the board.
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
      class="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:max-w-sm"
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
      <AdminCalendarBlocks
        v-model:starts-on="draftStartsOn"
        v-model:ends-on="draftEndsOn"
        :products="products"
        :blocks="blockedDates"
        @saved="onBlockSaved"
      />

      <div class="hidden overflow-hidden rounded-xl border border-stone-200 bg-white md:block">
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
          <button
            v-for="(date, index) in cells"
            :key="date || `empty-${index}`"
            type="button"
            class="min-h-28 border-b border-r border-stone-100 p-2 text-left last:border-r-0 disabled:cursor-default"
            :class="date && dayIsViewed(date)
              ? 'bg-lumen-50 ring-2 ring-inset ring-lumen-600'
              : date && dayIsPast(date)
                ? 'bg-stone-50 text-stone-400'
                : date === today
                  ? 'bg-lumen-50/60'
                  : date && dayIsSelected(date)
                    ? 'bg-amber-50'
                    : date && blocksOnDate(blockedDates, date).length
                      ? 'bg-stone-100'
                      : 'bg-white'"
            :disabled="!date"
            @click="date && openDay(date)"
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
                  v-for="block in blocksOnDate(blockedDates, date)"
                  :key="block.uuid"
                  class="rounded-md bg-stone-200/80 px-1.5 py-1"
                >
                  <p class="truncate text-xs font-medium text-stone-800">
                    Blocked · {{ block.productName }}
                  </p>
                </li>
                <li
                  v-for="item in eventsOnDate(items, date)"
                  :key="item.uuid"
                >
                  <div class="rounded-md px-1.5 py-1">
                    <p class="truncate text-xs font-medium text-stone-900">
                      {{ item.productName }}
                    </p>
                    <p class="truncate text-[11px] text-stone-500">
                      {{ item.code }}
                    </p>
                  </div>
                </li>
              </ul>
            </template>
          </button>
        </div>
      </div>

      <div class="rounded-xl border border-stone-200 bg-white p-3 md:hidden">
        <div class="grid grid-cols-7 text-center text-[11px] font-medium text-stone-500">
          <p
            v-for="label in weekdayLabels"
            :key="`mobile-${label}`"
          >
            {{ label.slice(0, 1) }}
          </p>
        </div>
        <div class="mt-2 grid grid-cols-7 gap-1">
          <button
            v-for="(date, index) in cells"
            :key="date || `mobile-empty-${index}`"
            type="button"
            class="aspect-square rounded-md text-sm"
            :class="!date
              ? 'invisible'
              : dayIsViewed(date)
                ? 'bg-lumen-100 font-medium text-lumen-800'
                : dayIsPast(date)
                  ? 'text-stone-300'
                  : date === today
                    ? 'bg-lumen-100 font-medium text-lumen-800'
                    : dayIsSelected(date)
                      ? 'bg-amber-100 text-stone-900'
                      : blocksOnDate(blockedDates, date).length
                        ? 'bg-stone-200 text-stone-800'
                        : 'text-stone-700'"
            :disabled="!date"
            @click="date && openDay(date)"
          >
            {{ date ? dayNumber(date) : '' }}
          </button>
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
          <button
            type="button"
            class="text-left"
            @click="openDay(day.date)"
          >
            <p class="text-sm font-medium text-stone-900">
              {{ formatBusinessDate(day.date) }}
            </p>
          </button>
          <ul class="mt-3 space-y-3">
            <li
              v-for="block in day.blocks"
              :key="block.uuid"
              class="rounded-lg bg-stone-100 px-3 py-2"
            >
              <p class="font-medium text-stone-900">
                Blocked · {{ block.productName }}
              </p>
              <p
                v-if="block.reason"
                class="mt-1 text-sm text-stone-500"
              >
                {{ block.reason }}
              </p>
            </li>
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

      <AdminCalendarDayDetails
        v-model:open="detailsOpen"
        :date="viewedDate"
        :items="viewedItems"
        :blocks="viewedBlocks"
        :can-block="canBlockViewedDay"
        @block="pickDay"
        @removed="refresh()"
      />
    </template>
  </div>
</template>
