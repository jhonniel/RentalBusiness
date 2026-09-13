<script setup lang="ts">
import { CalendarDate, parseDate } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'
import type { AvailabilityCalendar } from '~/types/availability'
import { calendarDateInZone, formatBookingDate } from '~/utils/datetime'

const model = defineModel<string>({ required: true })

const props = defineProps<{
  label: string
  productUuid?: string
  productSlug?: string
  quantity?: number
  disabled?: boolean
  min?: string
}>()

const today = calendarDateInZone()
const minDate = computed(() => props.min || today)
const canLoad = computed(() => Boolean(props.productUuid || props.productSlug))

const { data: calendar, execute: loadCalendar } = await useFetch<AvailabilityCalendar>(
  '/api/availability/calendar',
  {
    query: computed(() => ({
      productUuid: props.productUuid,
      productSlug: props.productSlug,
      quantity: props.quantity ?? 1,
    })),
    immediate: false,
  },
)

watch(canLoad, (ready) => {
  if (ready) {
    void loadCalendar()
  }
}, { immediate: true })

watch(() => [props.productUuid, props.productSlug, props.quantity], () => {
  if (canLoad.value) {
    void loadCalendar()
  }
})

const blocked = computed(() => new Set(calendar.value?.unavailableDates ?? []))

function dateKey(date: DateValue) {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
}

function isDateUnavailable(date: DateValue) {
  return blocked.value.has(dateKey(date))
}

function isDateDisabled(date: DateValue) {
  const key = dateKey(date)
  return key < minDate.value || blocked.value.has(key)
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
    if (!blocked.value.has(key) && key >= minDate.value) {
      model.value = key
    }
  },
})

watch([blocked, minDate], () => {
  if (model.value && (blocked.value.has(model.value) || model.value < minDate.value)) {
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
            v-model="calendarValue"
            :min-value="parseDate(minDate)"
            :is-date-disabled="isDateDisabled"
            :is-date-unavailable="isDateUnavailable"
          />
          <p
            v-if="canLoad && blocked.size"
            class="mt-2 px-2 pb-1 text-xs text-stone-500"
          >
            Crossed-out days are already booked.
          </p>
        </div>
      </template>
    </UPopover>
  </label>
</template>
