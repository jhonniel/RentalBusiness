<script setup lang="ts">
import type { AvailabilityResponse } from '~/types/availability'
import { FACEBOOK_MESSENGER_URL } from '~/utils/constants'
import { calendarDateInZone, formatBusinessDateTime } from '~/utils/datetime'
import { hourlyDiscountNote } from '~/utils/pricing'
import {
  DEFAULT_PICKUP_TIME,
  MAX_RENTAL_HOURS,
  MIN_RENTAL_HOURS,
  defaultRentalReturnOn,
  formatRentalReturnLabel,
  resolveHourlyRentalWindow,
  resolveRentalWindow,
} from '~/utils/rental-window'

const props = defineProps<{
  productUuid: string
  productSlug: string
  hourlyEnabled?: boolean
  hourlyPrice?: number | null
  hourlyLateFee?: number | null
  hourlyDiscount?: 'none' | 'per_hour' | 'hours'
  hourlyLess?: number
  hourlyLessHours?: number
  hourlyLessMinHours?: number
  dailyPrice?: number | null
  initialStartsOn?: string
  initialEndsOn?: string
  initialPickupTime?: string
  initialHours?: number
}>()

const { isAuthenticated } = useAuth()
const { formatMoney } = useCurrency()
const today = calendarDateInZone()
const billing = defineModel<'day' | 'hour'>('billing', { default: 'day' })
if (props.hourlyEnabled && props.initialHours) {
  billing.value = 'hour'
}
const hours = ref(props.initialHours && props.initialHours >= MIN_RENTAL_HOURS ? props.initialHours : 1)
const startsOn = ref(props.initialStartsOn || today)
const pickupTime = ref(props.initialPickupTime || DEFAULT_PICKUP_TIME)
const endsOn = ref(props.initialEndsOn && props.initialEndsOn > startsOn.value
  ? props.initialEndsOn
  : defaultRentalReturnOn(startsOn.value))
const pending = ref(false)
const formError = ref('')
const result = ref<AvailabilityResponse | null>(null)

const hourly = computed(() => billing.value === 'hour' && Boolean(props.hourlyEnabled))
const discountNote = computed(() => hourly.value
  ? hourlyDiscountNote(props, formatMoney)
  : '')
const activeRateLabel = computed(() => {
  if (hourly.value) {
    return props.hourlyPrice ? `${formatMoney(props.hourlyPrice)} per hour` : ''
  }
  return typeof props.dailyPrice === 'number' ? `${formatMoney(props.dailyPrice)} per day` : ''
})
const window = computed(() => hourly.value
  ? resolveHourlyRentalWindow({
      startsOn: startsOn.value,
      pickupTime: pickupTime.value,
      hours: hours.value,
    })
  : resolveRentalWindow({
      startsOn: startsOn.value,
      endsOn: endsOn.value,
      pickupTime: pickupTime.value,
    }))

const datesChosen = computed(() => Boolean(window.value.pickupAt && window.value.returnAt))

watch(startsOn, (value, previous) => {
  if (!value) {
    return
  }
  if (!endsOn.value || endsOn.value <= value || (previous && endsOn.value === defaultRentalReturnOn(previous))) {
    endsOn.value = defaultRentalReturnOn(value)
  }
})

watch([startsOn, endsOn, pickupTime, hours, billing], () => {
  result.value = null
  formError.value = ''
})

const rentQuery = computed(() => ({
  product: props.productSlug,
  startsOn: window.value.startsOn,
  endsOn: window.value.endsOn,
  pickupTime: window.value.pickupTime,
  quantity: '1',
  ...(hourly.value ? { hours: String(window.value.hours) } : {}),
}))

const rentTo = computed(() => {
  if (!isAuthenticated.value) {
    const hoursQuery = hourly.value ? `&hours=${window.value.hours}` : ''
    const next = `/rentals/new?product=${props.productSlug}&startsOn=${window.value.startsOn}&endsOn=${window.value.endsOn}&pickupTime=${encodeURIComponent(window.value.pickupTime)}&quantity=1${hoursQuery}`
    return { path: '/login', query: { redirect: next } }
  }

  return { path: '/rentals/new', query: rentQuery.value }
})

async function loadAvailability() {
  return $fetch<AvailabilityResponse>('/api/availability', {
    query: {
      productUuid: props.productUuid,
      productSlug: props.productSlug,
      startsOn: window.value.startsOn,
      endsOn: window.value.endsOn,
      pickupTime: window.value.pickupTime,
      quantity: 1,
      ...(hourly.value ? { hours: window.value.hours } : {}),
    },
  })
}

async function onSubmit() {
  formError.value = ''
  result.value = null
  if (!datesChosen.value) {
    formError.value = 'Choose a pickup date and a return date.'
    return
  }
  pending.value = true

  try {
    result.value = await loadAvailability()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not check those dates.'
  }
  finally {
    pending.value = false
  }
}

async function goRent() {
  formError.value = ''
  if (!datesChosen.value) {
    formError.value = 'Choose a pickup date and a return date.'
    return
  }
  pending.value = true

  try {
    result.value = await loadAvailability()
    if (!result.value.canFulfill) {
      return
    }
    await navigateTo(rentTo.value)
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not check those dates.'
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <form
    class="rounded-2xl border border-[#12201a]/8 bg-[#f7f8f7] p-5 font-[system-ui,sans-serif] tracking-normal sm:p-6"
    method="post"
    @submit.prevent="onSubmit"
  >
    <div>
      <h2 class="text-lg font-semibold text-[#12201a]">
        Check availability
      </h2>
      <p class="mt-1 text-sm leading-6 text-[#5b6b64]">
        {{ hourly
          ? 'Choose a pickup time and how many hours. The return time follows those hours.'
          : 'Choose a pickup time. Return is automatically the same time on the last day.' }}
      </p>
    </div>

    <BillingUnitSwitch
      v-if="hourlyEnabled"
      v-model="billing"
      class="mt-4"
    />
    <p
      v-if="hourlyEnabled"
      class="mt-3 min-h-6 text-sm font-medium text-[#12201a]"
    >
      <Transition
        name="billing-fade"
        mode="out-in"
      >
        <span
          v-if="activeRateLabel"
          :key="billing"
          class="inline-block"
        >{{ activeRateLabel }}</span>
      </Transition>
    </p>

    <div class="relative">
      <Transition name="billing-swap">
        <div
          v-if="hourly"
          key="hour"
          class="mt-5 grid gap-4 sm:grid-cols-2"
        >
          <BookingDateField
            v-model="startsOn"
            label="Pickup date"
            :product-uuid="productUuid"
            :product-slug="productSlug"
            :quantity="1"
            :disabled="pending"
          />
          <BookingPickupTime
            v-model="pickupTime"
            :product-uuid="productUuid"
            :product-slug="productSlug"
            :starts-on="startsOn"
            :ends-on="window.endsOn"
            :hours="hours"
            :disabled="pending"
          />
          <label class="block text-sm sm:col-span-2">
            <span class="mb-1.5 block text-[#12201a]">Hours</span>
            <input
              v-model.number="hours"
              type="number"
              inputmode="numeric"
              :min="MIN_RENTAL_HOURS"
              :max="MAX_RENTAL_HOURS"
              step="1"
              class="min-h-12 w-full rounded-xl border border-[#12201a]/15 bg-white px-3 py-2 text-base text-[#12201a]"
              :disabled="pending"
            >
            <span class="mt-1 block text-xs leading-5 text-[#5b6b64]">
              The total is calculated on the next step.
              <template v-if="discountNote">
                {{ discountNote }}
              </template>
              <template v-if="hourlyLateFee">
                A late return is {{ formatMoney(hourlyLateFee) }} for each hour.
              </template>
            </span>
          </label>
        </div>
        <div
          v-else
          key="day"
          class="mt-5 grid gap-4 sm:grid-cols-2"
        >
          <BookingDateRange
            v-model:starts-on="startsOn"
            v-model:ends-on="endsOn"
            :product-uuid="productUuid"
            :product-slug="productSlug"
            :quantity="1"
            :disabled="pending"
          >
            <template #between>
              <BookingPickupTime
                v-model="pickupTime"
                :product-uuid="productUuid"
                :product-slug="productSlug"
                :starts-on="startsOn"
                :ends-on="endsOn"
                :disabled="pending"
              />
            </template>
          </BookingDateRange>
        </div>
      </Transition>
    </div>

    <p
      v-if="datesChosen && hourly"
      class="mt-3 text-sm leading-6 text-[#12201a]"
    >
      Return {{ formatBusinessDateTime(window.returnAt) }}
      · {{ window.hours }} hour{{ window.hours === 1 ? '' : 's' }}
    </p>
    <p
      v-else-if="datesChosen"
      class="mt-3 text-sm leading-6 text-[#12201a]"
    >
      Return {{ formatRentalReturnLabel(window.endsOn, window.pickupTime) }}
      · {{ window.days }} day{{ window.days === 1 ? '' : 's' }}
    </p>
    <p
      v-else
      class="mt-3 text-sm leading-6 text-[#5b6b64]"
    >
      Choose an open pickup date. Crossed-out days are fully booked.
    </p>

    <AuthAlert
      v-if="formError"
      class="mt-4"
      :description="formError"
    />

    <div
      v-if="result"
      class="mt-4 flex items-start gap-3 rounded-xl px-4 py-3 text-sm leading-6 ring-1"
      :class="result.canFulfill ? 'bg-emerald-50 text-emerald-900 ring-emerald-200' : 'bg-red-50 text-red-900 ring-red-200'"
      role="status"
    >
      <UIcon
        :name="result.canFulfill ? 'i-lucide-circle-check' : 'i-lucide-circle-x'"
        class="mt-0.5 size-5 shrink-0"
        :class="result.canFulfill ? 'text-emerald-600' : 'text-red-600'"
      />
      <p
        v-if="result.canFulfill"
        class="font-semibold"
      >
        Unit is available
      </p>
      <div v-else>
        <p class="font-semibold">
          No unit available for the selected dates
        </p>
        <p class="mt-0.5">
          Try other dates, or
          <a
            :href="FACEBOOK_MESSENGER_URL"
            target="_blank"
            rel="noopener noreferrer"
            class="inline-flex items-center gap-1 font-semibold text-[#1877f2] underline underline-offset-2 max-sm:min-h-11"
          ><UIcon
            name="i-lucide-facebook"
            class="size-4"
          />message us on Facebook</a>
          to inquire more.
        </p>
      </div>
    </div>

    <div class="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
      <UButton
        type="submit"
        color="neutral"
        variant="outline"
        class="w-full justify-center rounded-full tracking-normal sm:w-auto"
        :loading="pending"
      >
        Check dates
      </UButton>
      <UButton
        color="neutral"
        class="w-full justify-center rounded-full bg-[#12201a] tracking-normal text-white hover:bg-[#1b2d26] sm:w-auto"
        :disabled="Boolean(result && !result.canFulfill)"
        @click="goRent"
      >
        {{ isAuthenticated ? 'Rent now' : 'Sign in to rent' }}
      </UButton>
      <UButton
        to="/products"
        color="neutral"
        variant="ghost"
        class="w-full justify-center rounded-full tracking-normal sm:w-auto"
      >
        Browse catalog
      </UButton>
    </div>
    <p class="mt-3 text-xs leading-5 text-[#5b6b64]">
      {{ isAuthenticated
        ? 'After you confirm pickup and return, you can submit a rental request.'
        : 'Sign in to send a rental request for this pickup and return.' }}
    </p>
  </form>
</template>
