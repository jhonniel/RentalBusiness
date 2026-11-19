<script setup lang="ts">
import { parseDate } from '@internationalized/date'
import type { DateValue } from '@internationalized/date'
import type { AvailabilityCalendar } from '~/types/availability'
import { nextBookingRange } from '~/utils/availability'
import { calendarDateInZone, formatBookingDate } from '~/utils/datetime'

const startsOn = defineModel<string>('startsOn', { required: true })
const endsOn = defineModel<string>('endsOn', { required: true })

const props = defineProps<{
  productUuid?: string
  productSlug?: string
  quantity?: number
  disabled?: boolean
  flexible?: boolean
  allowPast?: boolean
  availability?: AvailabilityCalendar | null
}>()

const today = calendarDateInZone()
const minDate = computed(() => props.allowPast ? '' : today)
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

const open = ref(false)
const choosingReturn = ref(false)
const rangeError = ref('')
const anchor = ref<HTMLElement>()
const openedFrom = ref<'pickup' | 'return'>('pickup')

function dateKey(date: DateValue) {
  return `${date.year}-${String(date.month).padStart(2, '0')}-${String(date.day).padStart(2, '0')}`
}

function isClosed(key: string) {
  return !props.flexible && closed.value.has(key)
}

function isDateDisabled(date: DateValue) {
  const key = dateKey(date)
  if (minDate.value && key < minDate.value) {
    return true
  }
  return isClosed(key)
}

const rangeValue = computed({
  get() {
    if (!startsOn.value) {
      return undefined
    }
    const start = parseDate(startsOn.value)
    const showReturn = !choosingReturn.value && endsOn.value > startsOn.value
    return {
      start,
      end: showReturn ? parseDate(endsOn.value) : undefined,
    }
  },
  set(value: { start?: DateValue, end?: DateValue } | null | undefined) {
    if (!value?.start) {
      return
    }
    const next = nextBookingRange(
      { startsOn: startsOn.value, endsOn: endsOn.value },
      { start: dateKey(value.start), end: value.end ? dateKey(value.end) : '' },
      { min: minDate.value, closed: closed.value, flexible: props.flexible },
    )
    rangeError.value = next.error === 'blocked'
      ? 'Those dates include a day that is already booked.'
      : next.error === 'order'
        ? 'Choose a return day after the pickup day.'
        : next.error === 'closed'
          ? 'That day is already booked.'
          : ''
    if (next.error === 'closed') {
      return
    }
    choosingReturn.value = !next.complete
    if (next.complete) {
      const end = next.endsOn
      endsOn.value = end
      startsOn.value = next.startsOn
      nextTick(() => {
        if (endsOn.value !== end) {
          endsOn.value = end
        }
      })
      open.value = false
      choosingReturn.value = false
      return
    }
    startsOn.value = next.startsOn
  },
})

function openFrom(field: 'pickup' | 'return', event: MouseEvent) {
  if (props.disabled) {
    return
  }
  openedFrom.value = field
  anchor.value = event.currentTarget as HTMLElement
  choosingReturn.value = false
  rangeError.value = ''
  open.value = true
}

function fieldClass(active: boolean) {
  return [
    'flex h-12 w-full items-center gap-3 rounded-xl border bg-white px-3.5 text-left text-sm tracking-normal text-[#12201a] transition-colors hover:border-[#12201a]/28 disabled:cursor-not-allowed disabled:opacity-60',
    active ? 'border-[#12201a]' : 'border-[#12201a]/12',
  ]
}

const pickupLabel = computed(() => startsOn.value ? formatBookingDate(startsOn.value) : 'Choose a date')
const returnLabel = computed(() => endsOn.value ? formatBookingDate(endsOn.value) : 'Choose a date')
const hint = computed(() => {
  if (rangeError.value) {
    return rangeError.value
  }
  if (choosingReturn.value) {
    return 'Now choose the return day. It has to be after the pickup day.'
  }
  return canLoad.value && !props.flexible
    ? 'Choose the pickup day, then the return day. Crossed-out days cannot be selected.'
    : 'Choose the pickup day, then the return day.'
})
</script>

<template>
  <div class="contents">
    <label class="relative block font-[system-ui,sans-serif] tracking-normal">
      <span class="mb-2 block text-xs font-medium text-[#5b6b64]">
        Pickup date
      </span>
      <button
        type="button"
        :class="fieldClass(open && openedFrom === 'pickup')"
        :disabled="disabled"
        :aria-expanded="open"
        @click="openFrom('pickup', $event)"
      >
        <UIcon
          name="i-lucide-calendar"
          class="size-4 shrink-0 text-[#5b6b64]"
        />
        <span class="min-w-0 truncate tracking-normal">{{ pickupLabel }}</span>
      </button>
      <UPopover
        v-model:open="open"
        :reference="anchor"
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
        <span class="absolute size-0 overflow-hidden" />
        <template #content>
          <div class="w-full min-w-0 p-2">
            <UCalendar
              :key="calendarKey"
              v-model="rangeValue"
              range
              color="neutral"
              :min-value="minDate ? parseDate(minDate) : undefined"
              :is-date-disabled="isDateDisabled"
              :is-date-unavailable="(date: DateValue) => isClosed(dateKey(date))"
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
            <p class="mt-2 px-1 pb-1 text-xs leading-5 text-balance text-stone-500">
              {{ hint }}
            </p>
          </div>
        </template>
      </UPopover>
    </label>

    <slot name="between" />

    <label class="block font-[system-ui,sans-serif] tracking-normal">
      <span class="mb-2 block text-xs font-medium text-[#5b6b64]">
        Return date
      </span>
      <button
        type="button"
        :class="fieldClass(open && openedFrom === 'return')"
        :disabled="disabled"
        :aria-expanded="open"
        @click="openFrom('return', $event)"
      >
        <UIcon
          name="i-lucide-calendar"
          class="size-4 shrink-0 text-[#5b6b64]"
        />
        <span class="min-w-0 truncate tracking-normal">{{ returnLabel }}</span>
      </button>
    </label>
  </div>
</template>
