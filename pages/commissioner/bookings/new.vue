<script setup lang="ts">
import type { RentalQuote } from '~/types/rental'
import { fieldErrors } from '~/utils/auth-validation'
import { calendarDateInZone } from '~/utils/datetime'
import { createCommissionerRentalSchema } from '~/utils/rental-validation'
import { DEFAULT_PICKUP_TIME, defaultRentalReturnOn } from '~/utils/rental-window'

definePageMeta({
  layout: 'commissioner',
  middleware: 'commissioner',
})

useSiteMeta({
  title: 'New booking',
  path: '/commissioner/bookings/new',
})

type EquipmentOption = {
  uuid: string
  name: string
  sku: string
  commissionPerDay: number
}

type CommissionerQuote = RentalQuote & {
  commissionPerDay: number
  commissionAmount: number
}

const today = calendarDateInZone()
const toast = useToast()
const { formatMoney } = useCurrency()
const form = reactive({
  productUuid: '',
  startsOn: today,
  endsOn: defaultRentalReturnOn(today),
  pickupTime: DEFAULT_PICKUP_TIME,
  quantity: 1,
  firstName: '',
  lastName: '',
  email: '',
  phone: '',
  notes: '',
})
const errors = ref<Record<string, string>>({})
const formError = ref('')
const pending = ref(false)
const quote = ref<CommissionerQuote | null>(null)
const created = ref<{ code: string, uuid: string, waiverUrl: string | null, commissionAmount: number } | null>(null)

const { data: equipment } = await useFetch<{ items: EquipmentOption[] }>('/api/commissioner/products')

const selected = computed(() => equipment.value?.items.find(item => item.uuid === form.productUuid) || null)

watch(() => form.startsOn, (startsOn) => {
  if (form.endsOn < startsOn) {
    form.endsOn = defaultRentalReturnOn(startsOn)
  }
})

async function refreshQuote() {
  quote.value = null
  if (!form.productUuid || !form.startsOn || !form.endsOn) {
    return
  }
  try {
    quote.value = await $fetch<CommissionerQuote>('/api/commissioner/rentals/quote', {
      method: 'POST',
      body: {
        productUuid: form.productUuid,
        startsOn: form.startsOn,
        endsOn: form.endsOn,
        pickupTime: form.pickupTime,
        quantity: form.quantity,
      },
    })
  }
  catch {
    quote.value = null
  }
}

watch(() => [form.productUuid, form.startsOn, form.endsOn, form.pickupTime, form.quantity], refreshQuote)

async function onSubmit() {
  formError.value = ''
  errors.value = {}
  const parsed = createCommissionerRentalSchema.safeParse(form)
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error)
    return
  }

  pending.value = true
  try {
    const rental = await $fetch<{
      uuid: string
      code: string
      waiverUrl: string | null
      commissionAmount?: number
    }>('/api/commissioner/rentals', {
      method: 'POST',
      body: parsed.data,
    })
    created.value = {
      uuid: rental.uuid,
      code: rental.code,
      waiverUrl: rental.waiverUrl,
      commissionAmount: rental.commissionAmount || 0,
    }
    toast.add({ title: 'Booking saved', color: 'success' })
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not save that booking.'
  }
  finally {
    pending.value = false
  }
}

async function copyLink() {
  if (!created.value?.waiverUrl || !import.meta.client) {
    return
  }
  await navigator.clipboard.writeText(created.value.waiverUrl)
  toast.add({ title: 'Link copied', color: 'success' })
}
</script>

<template>
  <div class="mx-auto w-full max-w-xl space-y-6">
    <div>
      <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
        Commissioner
      </p>
      <h1 class="mt-2 text-2xl font-medium text-stone-900">
        New booking
      </h1>
      <p class="mt-1 text-sm leading-6 text-stone-600">
        Book one piece of equipment for a client. The dates are held immediately. The shop confirms the booking, and your commission is recorded as an expense.
      </p>
    </div>

    <section
      v-if="created"
      class="rounded-xl border border-stone-200 bg-white p-5"
    >
      <h2 class="font-medium text-stone-900">
        {{ created.code }} is booked
      </h2>
      <p class="mt-2 text-sm leading-6 text-stone-600">
        Your commission on this booking is {{ formatMoney(created.commissionAmount) }}. The shop still needs to confirm it.
      </p>
      <p
        v-if="created.waiverUrl"
        class="mt-4 break-all rounded-md bg-stone-50 px-3 py-2 text-sm text-stone-800"
      >
        {{ created.waiverUrl }}
      </p>
      <div class="mt-4 flex flex-wrap gap-2">
        <UButton
          v-if="created.waiverUrl"
          color="neutral"
          variant="outline"
          @click="copyLink"
        >
          Copy waiver link
        </UButton>
        <UButton :to="`/commissioner/bookings/${created.code}`">
          Open booking
        </UButton>
      </div>
    </section>

    <form
      v-else
      class="space-y-5 rounded-xl border border-stone-200 bg-white p-5"
      @submit.prevent="onSubmit"
    >
      <label class="block text-sm">
        <span class="mb-1.5 block text-stone-700">Equipment</span>
        <select
          v-model="form.productUuid"
          class="w-full rounded-md border border-stone-200 bg-white px-3 py-2"
          :disabled="pending"
        >
          <option
            disabled
            value=""
          >
            Choose equipment
          </option>
          <option
            v-for="item in equipment?.items || []"
            :key="item.uuid"
            :value="item.uuid"
          >
            {{ item.name }}
          </option>
        </select>
        <span
          v-if="errors.productUuid"
          class="mt-1 block text-xs text-red-700"
        >{{ errors.productUuid }}</span>
        <span
          v-else-if="selected"
          class="mt-1 block text-xs text-stone-500"
        >
          Commission {{ formatMoney(selected.commissionPerDay) }} per day for each unit.
        </span>
      </label>

      <div class="grid gap-4 sm:grid-cols-2">
        <BookingDateField
          v-model="form.startsOn"
          label="Pickup date"
          :product-uuid="form.productUuid || undefined"
          :quantity="form.quantity"
          :disabled="pending"
        />
        <BookingDateField
          v-model="form.endsOn"
          label="Return date"
          :product-uuid="form.productUuid || undefined"
          :quantity="form.quantity"
          :min="form.startsOn"
          :disabled="pending"
        />
      </div>
      <BookingPickupTime
        v-model="form.pickupTime"
        :product-uuid="form.productUuid || undefined"
        :quantity="form.quantity"
        :starts-on="form.startsOn"
        :ends-on="form.endsOn"
        :disabled="pending"
      />
      <p
        v-if="errors.startsOn || errors.endsOn || errors.pickupTime"
        class="text-xs text-red-700"
      >
        {{ errors.startsOn || errors.endsOn || errors.pickupTime }}
      </p>

      <label class="block text-sm">
        <span class="mb-1.5 block text-stone-700">Quantity</span>
        <UInput
          v-model="form.quantity"
          class="w-full"
          type="number"
          min="1"
          max="99"
          :disabled="pending"
        />
      </label>

      <div class="grid gap-4 sm:grid-cols-2">
        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">First name</span>
          <UInput
            v-model="form.firstName"
            class="w-full"
            :disabled="pending"
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">Last name</span>
          <UInput
            v-model="form.lastName"
            class="w-full"
            :disabled="pending"
          />
        </label>
        <label class="block text-sm sm:col-span-2">
          <span class="mb-1.5 block text-stone-700">Email</span>
          <UInput
            v-model="form.email"
            class="w-full"
            type="email"
            :disabled="pending"
          />
        </label>
        <label class="block text-sm sm:col-span-2">
          <span class="mb-1.5 block text-stone-700">Phone number</span>
          <UInput
            v-model="form.phone"
            class="w-full"
            :disabled="pending"
          />
        </label>
      </div>
      <p class="text-xs leading-5 text-stone-500">
        Client details are optional. Send the waiver link so they can fill in anything still missing.
      </p>

      <label class="block text-sm">
        <span class="mb-1.5 block text-stone-700">Notes</span>
        <UTextarea
          v-model="form.notes"
          class="w-full"
          :rows="3"
          :disabled="pending"
        />
      </label>

      <div
        v-if="quote"
        class="rounded-md bg-stone-50 px-3 py-3 text-sm text-stone-700"
      >
        <p>Rent {{ formatMoney(quote.totalAmount) }} · Deposit {{ formatMoney(quote.depositAmount) }}</p>
        <p class="mt-1 font-medium text-stone-900">
          Your commission {{ formatMoney(quote.commissionAmount) }}
        </p>
        <p
          v-if="!quote.canFulfill"
          class="mt-1 text-red-700"
        >
          Those dates are not available.
        </p>
      </div>

      <p
        v-if="formError"
        class="text-sm text-red-700"
      >
        {{ formError }}
      </p>

      <UButton
        type="submit"
        block
        size="lg"
        :loading="pending"
        :disabled="!form.productUuid"
      >
        Book equipment
      </UButton>
    </form>
  </div>
</template>
