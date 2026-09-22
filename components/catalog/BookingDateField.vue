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
}>()

const today = calendarDateInZone()
const minDate = computed(() => props.min || today)
const canLoad = computed(() => Boolean(props.productUuid || props.productSlug))
const calendar = ref<AvailabilityCalendar | null>(null)

async function loadCalendar() {
  if (!canLoad.value) {
    calendar.value = null
    return
  }

  try {
    calendar.value = await $fetch<AvailabilityCalendar>('/api/availability/calendar', {
      query: {
        quantity: props.quantity ?? 1,
        ...(props.productUuid ? { productUuid: props.productUuid } : {}),
        ...(props.productSlug ? { productSlug: props.productSlug } : {}),
      },
    })
  }
  catch {
    calendar.value = null
  }
}

watch(
  () => [props.productUuid, props.productSlug, props.quantity] as const,
  () => {
    void loadCalendar()
  },
  { immediate: true },
)

const blocked = computed(() => new Set((calendar.value?.unavailableDates ?? []).map(date => date.slice(0, 10))))
const calendarKey = computed(() => [...blocked.value].join(','))

function dateKey(date: DateValue) {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
}

function isBooked(key: string) {
  return blocked.value.has(key)
}

function isBlockedRange(key: string) {
  if (props.min && rangeIncludesUnavailableDates(props.min, key, blocked.value)) {
    return true
  }

  if (props.until && key <= props.until && rangeIncludesUnavailableDates(key, props.until, blocked.value)) {
    return true
  }

  return false
}

function isDateUnavailable(date: DateValue) {
  return isBooked(dateKey(date))
}

function isDateDisabled(date: DateValue) {
  const key = dateKey(date)
  return key < minDate.value || isBooked(key) || isBlockedRange(key)
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
    if (key >= minDate.value && !isBooked(key) && !isBlockedRange(key)) {
      model.value = key
    }
  },
})

watch([blocked, minDate, () => props.until], () => {
  if (!model.value) {
    return
  }

  if (isBooked(model.value) || model.value < minDate.value || isBlockedRange(model.value)) {
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
    <UPopover :disabled="disabled">
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
        <div class="p-2">
          <UCalendar
            :key="calendarKey"
            v-model="calendarValue"
            :min-value="parseDate(minDate)"
            :is-date-disabled="isDateDisabled"
            :is-date-unavailable="isDateUnavailable"
          >
            <template #day="{ day }">
              <span :class="isBooked(dateKey(day)) ? 'text-stone-400 line-through' : ''">
                {{ day.day }}
              </span>
            </template>
          </UCalendar>
          <p
            v-if="canLoad"
            class="mt-2 px-2 pb-1 text-xs text-stone-500"
          >
            {{ blocked.size
              ? 'Gray crossed-out days are already booked. Choose another date.'
              : 'Free days can still be booked. Booked days stay disabled.' }}
          </p>
        </div>
      </template>
    </UPopover>
  </label>
</template>
