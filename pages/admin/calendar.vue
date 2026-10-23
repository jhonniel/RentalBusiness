<script setup lang="ts">
import type { PublicBlockedDate } from '~/types/availability'
import type { ProductListResponse } from '~/types/catalog'
import type { AdminCalendar, AdminCalendarEvent } from '~/types/calendar'
import { CALENDAR_RENTAL_STATUSES, canBlockProductDates } from '~/utils/constants'
import {
  applyCalendarPick,
  blocksOnDate,
  bookingColor,
  calendarAgenda,
  calendarWeekBars,
  calendarWeeks,
  eventsOnDate,
  isDateInRange,
  isExtensionDay,
  monthKey,
  shiftMonth,
} from '~/utils/calendar'
import { calendarDateInZone, formatBookingDate, formatBookingDateRange, formatBusinessDate } from '~/utils/datetime'

type CalendarEntry
  = | { kind: 'block', key: string, startsOn: string, endsOn: string, block: PublicBlockedDate }
    | { kind: 'booking', key: string, startsOn: string, endsOn: string, pickupAt?: string | null, returnAt?: string | null, originalEndsOn?: string | null, item: AdminCalendarEvent }

const EXTENSION_STRIPES = 'repeating-linear-gradient(135deg, rgb(255 255 255 / 0.75) 0 5px, transparent 5px 10px)'

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
const focusCode = ref('')

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
const entries = computed<CalendarEntry[]>(() => [
  ...blockedDates.value.map(block => ({
    kind: 'block' as const,
    key: `block-${block.uuid}`,
    startsOn: block.startsOn,
    endsOn: block.endsOn,
    block,
  })),
  ...items.value.map(item => ({
    kind: 'booking' as const,
    key: item.uuid,
    startsOn: item.startsOn,
    endsOn: item.endsOn,
    pickupAt: item.pickupAt,
    returnAt: item.returnAt,
    originalEndsOn: item.originalEndsOn,
    item,
  })),
])
const weeks = computed(() => calendarWeeks(month.value).map(days => ({
  days,
  ...calendarWeekBars(entries.value, days),
})))
const focusedItems = computed(() => (
  focusCode.value ? items.value.filter(item => item.code === focusCode.value) : items.value
))
const agenda = computed(() => calendarAgenda(
  focusedItems.value,
  month.value,
  focusCode.value ? [] : blockedDates.value,
))
const focusedItem = computed(() => items.value.find(item => item.code === focusCode.value) ?? null)
const cells = computed(() => weeks.value.flatMap(week => week.days))
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

function dayHasBooking(date: string) {
  return eventsOnDate(items.value, date).length > 0
}

function dayHasBlock(date: string) {
  return blocksOnDate(blockedDates.value, date).length > 0
}

function weekRows(lanes: number) {
  return `1.75rem${lanes ? ` repeat(${lanes}, 2.5rem)` : ''} minmax(1rem, 1fr)`
}

function barTitle(item: AdminCalendarEvent) {
  return [
    item.code,
    item.productName,
    item.customerName,
    formatBookingDateRange(item.startsOn, item.endsOn),
    item.originalEndsOn ? `extended after ${formatBookingDate(item.originalEndsOn)}` : '',
  ]
    .filter(Boolean)
    .join(' · ')
}

function barPercent(columns: number, span: number) {
  return `${(columns / span) * 100}%`
}

function isDimmed(item: AdminCalendarEvent) {
  return Boolean(focusCode.value) && item.code !== focusCode.value
}

function focusBooking(item: AdminCalendarEvent) {
  if (status.value && status.value !== item.status) {
    status.value = ''
  }
  month.value = monthKey(item.startsOn)
  focusCode.value = item.code
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
    <div>
      <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
        Operations
      </p>
      <h2 class="mt-2 text-2xl font-medium text-stone-900">
        Calendar
      </h2>
      <p class="mt-1 max-w-3xl text-sm text-stone-600">
        Rentals and blocked dates for this month in Asia/Manila. Click a day to view details, or a booking bar to open it. Cancelled and rejected requests stay off the board.
      </p>
    </div>

    <div class="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_14rem_auto] lg:items-end">
      <div class="block text-sm sm:col-span-2 lg:order-last lg:col-span-1">
        <span class="mb-1 block text-xs font-medium text-stone-600">Month</span>
        <div class="flex items-center gap-1">
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-chevron-left"
            aria-label="Previous month"
            @click="month = shiftMonth(month, -1)"
          />
          <p class="min-w-32 flex-1 text-center text-sm font-medium whitespace-nowrap text-stone-900 lg:flex-none">
            {{ monthLabel }}
          </p>
          <UButton
            color="neutral"
            variant="outline"
            icon="i-lucide-chevron-right"
            aria-label="Next month"
            @click="month = shiftMonth(month, 1)"
          />
          <UButton
            color="neutral"
            variant="ghost"
            :disabled="month === monthKey(today)"
            @click="month = monthKey(today)"
          >
            Today
          </UButton>
        </div>
      </div>
      <AdminCalendarSearch
        class="lg:order-first"
        @pick="focusBooking"
      />
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
      <div
        v-if="focusCode"
        class="flex flex-wrap items-center gap-2 rounded-lg bg-stone-50 px-3 py-2 text-sm sm:col-span-2 lg:order-last lg:col-span-3"
      >
        <span
          class="size-2.5 shrink-0 rounded-full"
          :class="bookingColor(focusCode).dot"
        />
        <span class="min-w-0 flex-1 text-stone-700">
          Showing <NuxtLink
            :to="`/admin/rentals/${focusCode}`"
            class="font-medium text-stone-900 underline-offset-2 hover:underline"
          >{{ focusCode }}</NuxtLink>
          <template v-if="focusedItem">
            · {{ focusedItem.productName }} · {{ formatBookingDateRange(focusedItem.startsOn, focusedItem.endsOn) }}
          </template>
          <template v-else>
            · not in {{ monthLabel }}
          </template>
        </span>
        <UButton
          color="neutral"
          variant="ghost"
          size="xs"
          @click="focusCode = ''"
        >
          Show all
        </UButton>
      </div>
    </div>

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
        @saved="onBlockSaved"
      />

      <div class="hidden min-w-0 overflow-x-auto rounded-xl border border-stone-200 bg-white md:block">
        <div class="grid min-w-0 grid-cols-7 border-b border-stone-100 bg-stone-50 text-xs font-medium text-stone-500">
          <p
            v-for="label in weekdayLabels"
            :key="label"
            class="px-3 py-2"
          >
            {{ label }}
          </p>
        </div>
        <div
          v-for="(week, weekIndex) in weeks"
          :key="`week-${weekIndex}`"
          class="grid min-h-28 min-w-0 grid-cols-7 border-b border-stone-100 last:border-b-0"
          :style="{ gridTemplateRows: weekRows(week.lanes) }"
        >
          <button
            v-for="(date, index) in week.days"
            :key="date || `empty-${weekIndex}-${index}`"
            type="button"
            class="flex min-w-0 flex-col items-start justify-start border-r border-stone-100 p-2 text-left last:border-r-0 disabled:cursor-default"
            :style="{ gridColumn: index + 1, gridRow: '1 / -1' }"
            :class="date && dayIsViewed(date)
              ? 'bg-lumen-50 ring-2 ring-inset ring-lumen-600'
              : date && dayIsPast(date)
                ? 'bg-stone-50 text-stone-400'
                : date === today
                  ? 'bg-lumen-50/60'
                  : date && dayIsSelected(date)
                    ? 'bg-amber-50'
                    : date && dayHasBlock(date)
                      ? 'bg-stone-100'
                      : date && dayHasBooking(date)
                        ? 'bg-lumen-50/40'
                        : 'bg-white'"
            :disabled="!date"
            @click="date && openDay(date)"
          >
            <p
              v-if="date"
              class="text-xs font-medium"
              :class="date === today ? 'text-lumen-800' : 'text-stone-500'"
            >
              {{ dayNumber(date) }}
            </p>
          </button>
          <template
            v-for="bar in week.bars"
            :key="`${weekIndex}-${bar.entry.key}`"
          >
            <div
              v-if="bar.entry.kind === 'block'"
              class="pointer-events-none z-10 my-0.5 flex min-w-0 items-center bg-stone-200/90 px-1.5"
              :class="[
                bar.continuesBefore ? 'ml-0 rounded-l-none' : 'ml-1 rounded-l-md',
                bar.continuesAfter ? 'mr-0 rounded-r-none' : 'mr-1 rounded-r-md',
                focusCode ? 'opacity-30' : '',
              ]"
              :style="{ gridColumn: `${bar.column} / span ${bar.span}`, gridRow: bar.lane + 2 }"
            >
              <p class="truncate text-xs font-medium text-stone-800">
                Blocked · {{ bar.entry.block.productName }}
              </p>
            </div>
            <NuxtLink
              v-else
              :to="`/admin/rentals/${bar.entry.item.code}`"
              :title="barTitle(bar.entry.item)"
              class="relative z-10 my-0.5 flex min-w-0 flex-col justify-center overflow-hidden px-1.5 ring-1 ring-inset transition-opacity hover:brightness-95"
              :class="[
                bookingColor(bar.entry.item.code).bar,
                bar.continuesBefore ? 'ml-0 rounded-l-none' : 'ml-1 rounded-l-md',
                bar.continuesAfter ? 'mr-0 rounded-r-none' : 'mr-1 rounded-r-md',
                isDimmed(bar.entry.item) ? 'opacity-30' : '',
                focusCode === bar.entry.item.code ? 'ring-2' : '',
              ]"
              :style="{ gridColumn: `${bar.column} / span ${bar.span}`, gridRow: bar.lane + 2 }"
            >
              <span
                v-if="bar.extensionFrom !== null"
                class="pointer-events-none absolute inset-y-0 right-0 flex items-center justify-end bg-white/45 pr-1.5"
                :class="bar.extensionFrom > 0 ? 'border-l-2 border-dashed border-stone-500/50' : ''"
                :style="{ left: barPercent(bar.extensionFrom, bar.span), backgroundImage: EXTENSION_STRIPES }"
              >
                <span
                  v-if="bar.extensionFrom > 0"
                  class="rounded bg-white/90 px-1 text-[10px] font-semibold tracking-wide uppercase"
                >
                  Extended
                </span>
              </span>
              <div
                class="relative min-w-0 pr-1"
                :style="bar.extensionFrom ? { maxWidth: barPercent(bar.extensionFrom, bar.span) } : undefined"
              >
                <p class="truncate text-xs font-medium leading-tight">
                  {{ bar.entry.item.code }}
                </p>
                <p class="truncate text-[11px] leading-tight opacity-75">
                  <template v-if="bar.extensionFrom === 0">
                    Extended ·
                  </template>
                  {{ bar.entry.item.productName }}
                  <template v-if="bar.entry.item.customerName">
                    · {{ bar.entry.item.customerName }}
                  </template>
                </p>
              </div>
            </NuxtLink>
          </template>
        </div>
      </div>

      <div class="w-full min-w-0 rounded-xl border border-stone-200 bg-white p-3 md:hidden">
        <div class="grid w-full min-w-0 grid-cols-7 text-center text-[11px] font-medium text-stone-500">
          <p
            v-for="label in weekdayLabels"
            :key="`mobile-${label}`"
          >
            {{ label.slice(0, 1) }}
          </p>
        </div>
        <div class="mt-2 grid w-full min-w-0 grid-cols-7 gap-1">
          <button
            v-for="(date, index) in cells"
            :key="date || `mobile-empty-${index}`"
            type="button"
            class="relative aspect-square min-h-0 min-w-0 rounded-md text-sm"
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
                      : dayHasBlock(date)
                        ? 'bg-stone-200 text-stone-800'
                        : dayHasBooking(date)
                          ? 'bg-lumen-100 text-lumen-900'
                          : 'text-stone-700'"
            :disabled="!date"
            @click="date && openDay(date)"
          >
            {{ date ? dayNumber(date) : '' }}
            <span
              v-if="date && eventsOnDate(focusedItems, date).length"
              class="absolute bottom-1 left-1/2 flex -translate-x-1/2 gap-0.5"
            >
              <span
                v-for="item in eventsOnDate(focusedItems, date).slice(0, 3)"
                :key="item.uuid"
                class="size-1.5 rounded-full"
                :class="bookingColor(item.code).dot"
              />
            </span>
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
                <p class="flex items-center gap-2 font-medium text-stone-900">
                  <span
                    class="size-2 shrink-0 rounded-full"
                    :class="bookingColor(item.code).dot"
                  />
                  {{ item.productName }}
                </p>
                <p class="mt-1 text-sm break-words text-stone-500">
                  {{ item.code }}
                  <template v-if="item.customerName">
                    · {{ item.customerName }}
                  </template>
                  · {{ formatBusinessDate(item.startsOn) }} – {{ formatBusinessDate(item.endsOn) }}
                </p>
                <p
                  v-if="isExtensionDay(item, day.date)"
                  class="mt-1 text-xs font-medium text-amber-700"
                >
                  Extension day · first booking ended {{ formatBookingDate(item.originalEndsOn!) }}
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
