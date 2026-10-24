<script setup lang="ts">
import { CalendarDate, parseDate } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'
import type { AvailabilityCalendar } from '~/types/availability'
import { rangeIncludesUnavailableDates } from '~/utils/availability'
import { calendarDateInZone, formatBookingDate } from '~/utils/datetime'

const model = defineModel<string>({ required: true })

const props = defineProps<{
  label: string
  productUuid?: string
  productSlug?: string
  quantity?: number
  disabled?: boolean
  min?: string
  until?: string
  flexible?: boolean
  allowPast?: boolean
  availability?: AvailabilityCalendar | null
}>()

const today = calendarDateInZone()
const minDate = computed(() => props.min || (props.allowPast ? '' : today))
const { calendar: fetchedCalendar, enabled: fetchEnabled } = useAvailabilityCalendar(() => (
  props.availability
    ? {}
    : {
        productUuid: props.productUuid,
        productSlug: props.productSlug,
        quantity: props.quantity,
      }
))
const calendar = computed(() => props.availability ?? fetchedCalendar.value)
const canLoad = computed(() => Boolean(props.availability?.product.uuid) || fetchEnabled.value)

const closed = computed(() => new Set((calendar.value?.unavailableDates ?? []).map(date => date.slice(0, 10))))
const calendarKey = computed(() => [...closed.value].join(','))

function dateKey(date: DateValue) {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
}

function isClosed(key: string) {
  return closed.value.has(key)
}

function isBlockedRange(key: string) {
  if (props.min && rangeIncludesUnavailableDates(props.min, key, closed.value)) {
    return true
  }

  if (props.until && key <= props.until && rangeIncludesUnavailableDates(key, props.until, closed.value)) {
    return true
  }

  return false
}

function isDateUnavailable(date: DateValue) {
  return props.flexible ? false : isClosed(dateKey(date))
}

function isDateDisabled(date: DateValue) {
  const key = dateKey(date)
  if (key < minDate.value) {
    return true
  }

  if (props.flexible) {
    return false
  }

  return isClosed(key) || isBlockedRange(key)
}

const calendarValue = computed({
  get() {
    return model.value ? parseDate(model.value) : undefined
  },
  set(value: CalendarDate | undefined) {
    if (!value) {
      return
    }
    const key = dateKey(value)
    if (key < minDate.value) {
      return
    }
    if (!props.flexible && (isClosed(key) || isBlockedRange(key))) {
      return
    }
    model.value = key
  },
})

watch([closed, minDate, () => props.until], () => {
  if (props.flexible || !model.value) {
    return
  }

  if (isClosed(model.value) || model.value < minDate.value || isBlockedRange(model.value)) {
    model.value = ''
  }
})

const displayValue = computed(() => model.value ? formatBookingDate(model.value) : 'Choose a date')
</script>

<template>
  <label class="block font-[system-ui,sans-serif] tracking-normal">
    <span class="mb-2 block text-xs font-medium text-[#5b6b64]">
      {{ label }}
    </span>
    <UPopover
      :disabled="disabled"
      :content="{
        align: 'center',
        side: 'bottom',
        avoidCollisions: true,
        collisionPadding: 12,
      }"
      :ui="{
        content: 'z-[80] w-[min(18.5rem,calc(100dvw-1.5rem))] max-w-[calc(100dvw-1.5rem)]',
      }"
    >
      <button
        type="button"
        class="flex h-12 w-full items-center gap-3 rounded-xl border border-[#12201a]/12 bg-white px-3.5 text-left text-sm tracking-normal text-[#12201a] transition-colors hover:border-[#12201a]/28 disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="disabled"
      >
        <UIcon
          name="i-lucide-calendar"
          class="size-4 shrink-0 text-[#5b6b64]"
        />
        <span class="min-w-0 truncate tracking-normal">{{ displayValue }}</span>
      </button>
      <template #content>
        <div class="w-full min-w-0 p-2">
          <UCalendar
            :key="calendarKey"
            v-model="calendarValue"
            :min-value="minDate ? parseDate(minDate) : undefined"
            :is-date-disabled="isDateDisabled"
            :is-date-unavailable="isDateUnavailable"
            :ui="{
              grid: 'w-full table-fixed',
              gridRow: 'grid w-full grid-cols-7',
              gridWeekDaysRow: 'mb-1 grid w-full grid-cols-7',
              cell: 'relative w-full min-w-0 text-center',
              headCell: 'w-full min-w-0',
              cellTrigger: 'mx-auto aspect-square size-8 max-w-full',
            }"
          >
            <template #day="{ day }">
              <span class="relative flex size-full items-center justify-center">
                <span :class="isClosed(dateKey(day)) ? 'text-stone-400 line-through' : ''">
                  {{ day.day }}
                </span>
              </span>
            </template>
          </UCalendar>
          <p
            v-if="canLoad && !flexible"
            class="mt-2 px-1 pb-1 text-xs leading-5 text-balance text-stone-500"
          >
            Crossed-out days cannot be selected.
          </p>
        </div>
      </template>
    </UPopover>
  </label>
</template>
