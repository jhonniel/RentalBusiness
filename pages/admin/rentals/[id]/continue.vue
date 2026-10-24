<script setup lang="ts">
import type { PublicRental, RentalQuote } from '~/types/rental'
import type { AdminSystemUser } from '~/types/notification'
import { fieldErrors } from '~/utils/auth-validation'
import { calendarDateInZone } from '~/utils/datetime'
import { continueAdminRentalSchema } from '~/utils/rental-validation'
import { defaultRentalReturnOn, formatRentalReturnLabel, normalizePickupTime, resolveRentalWindow } from '~/utils/rental-window'
import { canModifyAdminRental, canOpenAdminContinue } from '~/utils/waiver-invite'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const toast = useToast()
const { formatMoney } = useCurrency()
const identifier = computed(() => String(route.params.id))
const today = calendarDateInZone()

const { data: rental, error, refresh } = await useFetch<PublicRental>(
  () => `/api/admin/rentals/${identifier.value}`,
)
const { data: commissioners } = await useFetch<AdminSystemUser[]>('/api/admin/commissioners')

if (error.value?.statusCode === 404) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Rental not found',
  })
}

useSiteMeta({
  title: rental.value ? `Continue ${rental.value.code}` : 'Continue rental',
  path: `/admin/rentals/${identifier.value}/continue`,
})

const form = reactive({
  startsOn: rental.value?.startsOn || today,
  endsOn: rental.value?.endsOn || defaultRentalReturnOn(today),
  pickupTime: normalizePickupTime(rental.value?.pickupTime),
  quantity: rental.value?.items[0]?.quantity || 1,
  firstName: rental.value?.customer?.firstName || '',
  lastName: rental.value?.customer?.lastName || '',
  phone: rental.value?.customer?.phone || '',
  notes: rental.value?.notes || '',
  commissionerUuid: rental.value?.commissioner?.uuid || '',
})
const errors = ref<Record<string, string>>({})
const formError = ref('')
const quoteError = ref('')
const pending = ref(false)
const quoting = ref(false)
const quote = ref<(RentalQuote & { commissionAmount?: number }) | null>(null)

const rentalWindow = computed(() => resolveRentalWindow({
  startsOn: form.startsOn,
  endsOn: form.endsOn,
  pickupTime: form.pickupTime,
}))
const productSlug = computed(() => rental.value?.items[0]?.product.slug || '')
const canModify = computed(() => rental.value ? canModifyAdminRental(rental.value) : false)
const listedCommissioner = computed(() => {
  const uuid = rental.value?.commissioner?.uuid
  return Boolean(uuid && commissioners.value?.some(person => person.uuid === uuid))
})
const canOpen = computed(() => rental.value ? canOpenAdminContinue(rental.value) : false)

watch(rental, (value) => {
  if (!value) {
    return
  }
  form.startsOn = value.startsOn
  form.endsOn = value.endsOn <= value.startsOn ? defaultRentalReturnOn(value.startsOn) : value.endsOn
  form.pickupTime = normalizePickupTime(value.pickupTime)
  form.quantity = value.items[0]?.quantity || 1
  form.firstName = value.customer?.firstName || ''
  form.lastName = value.customer?.lastName || ''
  form.phone = value.customer?.phone || ''
  form.notes = value.notes || ''
  form.commissionerUuid = value.commissioner?.uuid || ''
}, { immediate: true })

watch(() => form.startsOn, (value, previous) => {
  if (!value) {
    return
  }
  if (!form.endsOn || form.endsOn <= value || (previous && form.endsOn === defaultRentalReturnOn(previous))) {
    form.endsOn = defaultRentalReturnOn(value)
  }
})

async function refreshQuote() {
  if (!productSlug.value || !form.startsOn || !form.endsOn) {
    return
  }

  quoting.value = true
  quoteError.value = ''
  try {
    quote.value = await $fetch<RentalQuote & { commissionAmount?: number }>('/api/admin/rentals/quote', {
      method: 'POST',
      body: {
        productSlug: productSlug.value,
        startsOn: form.startsOn,
        endsOn: form.endsOn,
        pickupTime: form.pickupTime,
        quantity: form.quantity,
        exceptRentalUuid: rental.value?.uuid,
        ...(form.commissionerUuid ? { commissionerUuid: form.commissionerUuid } : {}),
      },
    })
  }
  catch (error) {
    quote.value = null
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    quoteError.value = payload?.message || 'We could not price those dates.'
  }
  finally {
    quoting.value = false
  }
}

watchDebounced(
  () => [form.startsOn, form.endsOn, form.pickupTime, form.quantity, form.commissionerUuid, productSlug.value, rental.value?.uuid],
  () => {
    void refreshQuote()
  },
  { debounce: 300, immediate: true },
)

async function onSubmit() {
  if (!rental.value) {
    return false
  }

  formError.value = ''
  errors.value = {}
  const parsed = continueAdminRentalSchema.safeParse(form)
  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error)
    formError.value = parsed.error.issues[0]?.message || 'Please check the submitted information.'
    return false
  }

  pending.value = true
  try {
    await $fetch(`/api/admin/rentals/${rental.value.uuid}/continue`, {
      method: 'PATCH',
      body: parsed.data,
    })
    toast.add({
      title: rental.value.waiver && rental.value.status === 'draft'
        ? 'Rental booked'
        : rental.value.status === 'draft'
          ? 'Rental details saved'
          : 'Booking updated',
      color: 'success',
    })
    await refresh()
    return true
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not save those rental details.'
    return false
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="w-full space-y-6">
    <UButton
      :to="`/admin/rentals/${identifier}`"
      color="neutral"
      variant="ghost"
      class="-ml-2"
    >
      Back to rental
    </UButton>

    <div>
      <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
        {{ rental?.code || 'Rental' }}
      </p>
      <h2 class="mt-2 text-2xl font-medium text-stone-900">
        Continue rental form
      </h2>
      <p class="mt-1 text-sm text-stone-600">
        Finish the customer details and send the waiver link. After the waiver is signed, saving books the rental. A confirmed booking can still be changed here, and the new dates stay held.
      </p>
    </div>

    <AdminNotice
      v-if="error?.statusCode === 503"
      title="Rentals are not connected"
      description="Add live Supabase credentials to continue this request."
    />

    <AdminNotice
      v-else-if="rental && !canOpen"
      title="This rental cannot be continued"
      description="Only open rentals can be finished or unsigned so the customer can agree and sign again."
    />

    <form
      v-else-if="rental"
      class="grid gap-6 xl:grid-cols-2 xl:items-start"
      method="post"
      @submit.prevent="onSubmit"
    >
      <div class="space-y-6">
        <AuthAlert
          v-if="formError"
          :description="formError"
        />

        <section class="rounded-xl border border-stone-200 bg-white p-5">
          <h3 class="text-sm font-medium text-stone-900">
            Equipment
          </h3>
          <p class="mt-2 text-sm text-stone-700">
            {{ rental.items[0]?.product.name || 'No equipment' }}
          </p>
        </section>

        <section class="rounded-xl border border-stone-200 bg-white p-5">
          <h3 class="text-sm font-medium text-stone-900">
            Pickup and return
          </h3>
          <p class="mt-2 text-sm text-stone-600">
            You can change the pickup date, return date, and pickup time, including past dates, for example to record a pickup that already happened or to extend the return date. Return stays at the same clock on the return date.
          </p>
          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            <BookingDateField
              v-model="form.startsOn"
              label="Pickup date"
              :product-slug="productSlug || undefined"
              :quantity="form.quantity"
              :until="form.endsOn || undefined"
              :disabled="pending || !canModify"
              flexible
              allow-past
            />
            <BookingPickupTime
              v-model="form.pickupTime"
              :product-slug="productSlug || undefined"
              :starts-on="form.startsOn"
              :ends-on="form.endsOn"
              :own-pickup-at="rental.pickupAt"
              :own-return-at="rental.returnAt"
              :disabled="pending || !canModify"
              flexible
            />
            <BookingDateField
              v-model="form.endsOn"
              label="Return date"
              :product-slug="productSlug || undefined"
              :quantity="form.quantity"
              :min="form.startsOn || undefined"
              :disabled="pending || !canModify"
              flexible
            />
          </div>
          <p class="mt-3 text-sm text-stone-600">
            Return {{ formatRentalReturnLabel(rentalWindow.endsOn, rentalWindow.pickupTime) }}
          </p>
          <p
            v-if="quoteError"
            class="mt-3 text-sm text-red-800"
          >
            {{ quoteError }}
          </p>
        </section>

        <section
          v-if="quote"
          class="rounded-xl border border-stone-200 bg-white p-5"
        >
          <h3 class="text-sm font-medium text-stone-900">
            Summary
          </h3>
          <dl class="mt-4 space-y-2 text-sm">
            <div class="flex justify-between gap-4">
              <dt class="text-stone-500">
                {{ quote.days }} day{{ quote.days === 1 ? '' : 's' }}
              </dt>
              <dd>{{ formatMoney(quote.rentAmount) }}</dd>
            </div>
            <div
              v-if="quote.lessAmount > 0"
              class="flex justify-between gap-4"
            >
              <dt class="text-stone-500">
                Less
              </dt>
              <dd>−{{ formatMoney(quote.lessAmount) }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-stone-500">
                Deposit
              </dt>
              <dd>{{ formatMoney(quote.depositAmount) }}</dd>
            </div>
            <div class="flex justify-between gap-4 font-medium text-stone-900">
              <dt>Amount due</dt>
              <dd>{{ formatMoney(quote.totalAmount + quote.depositAmount) }}</dd>
            </div>
            <div
              v-if="form.commissionerUuid"
              class="flex justify-between gap-4"
            >
              <dt class="text-stone-500">
                Commissioner commission
              </dt>
              <dd>{{ formatMoney(quote.commissionAmount || 0) }}</dd>
            </div>
          </dl>
          <p
            class="mt-4 text-sm"
            :class="quote.canFulfill ? 'text-lumen-800' : 'text-red-800'"
          >
            {{ quote.canFulfill
              ? `${quote.available} units are free for these dates.`
              : 'That quantity is not available for these dates.' }}
          </p>
        </section>
      </div>

      <div class="space-y-6">
        <section class="rounded-xl border border-stone-200 bg-white p-5">
          <h3 class="text-sm font-medium text-stone-900">
            Customer details
          </h3>
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <p class="text-sm text-stone-600 sm:col-span-2">
              Account email: {{ rental.customer?.email || 'Not on file' }}
            </p>
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">First name</span>
              <UInput
                v-model="form.firstName"
                :disabled="pending || !canModify"
              />
              <span
                v-if="errors.firstName"
                class="mt-1 block text-xs text-red-700"
              >{{ errors.firstName }}</span>
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Last name</span>
              <UInput
                v-model="form.lastName"
                :disabled="pending || !canModify"
              />
              <span
                v-if="errors.lastName"
                class="mt-1 block text-xs text-red-700"
              >{{ errors.lastName }}</span>
            </label>
            <label class="block text-sm sm:col-span-2">
              <span class="mb-1.5 block text-stone-700">Phone</span>
              <UInput
                v-model="form.phone"
                type="tel"
                :disabled="pending || !canModify"
              />
            </label>
            <label class="block text-sm sm:col-span-2">
              <span class="mb-1.5 block text-stone-700">Commissioner</span>
              <select
                v-model="form.commissionerUuid"
                class="h-10 w-full rounded-md border border-stone-200 bg-white px-2 text-sm text-stone-800"
                :disabled="pending || !canModify"
              >
                <option value="">
                  No commissioner
                </option>
                <option
                  v-if="rental.commissioner && !listedCommissioner"
                  :value="rental.commissioner.uuid"
                >
                  {{ rental.commissioner.firstName }} {{ rental.commissioner.lastName }}
                </option>
                <option
                  v-for="person in commissioners"
                  :key="person.uuid"
                  :value="person.uuid"
                >
                  {{ person.firstName }} {{ person.lastName }}
                </option>
              </select>
              <span
                v-if="errors.commissionerUuid"
                class="mt-1 block text-xs text-red-700"
              >{{ errors.commissionerUuid }}</span>
              <span class="mt-1 block text-xs text-stone-500">
                Assigning a commissioner records their commission for this booking.
              </span>
            </label>
            <label class="block text-sm sm:col-span-2">
              <span class="mb-1.5 block text-stone-700">Notes</span>
              <UTextarea
                v-model="form.notes"
                :rows="3"
                :disabled="pending || !canModify"
              />
            </label>
          </div>
        </section>

        <AdminIdentityUpload
          :rental="rental"
          @uploaded="refresh"
        />

        <AdminWaiverSign
          :rental="rental"
          :disabled="pending"
          @signed="refresh"
          @reset="refresh"
        />

        <div
          v-if="canModify"
          class="space-y-3"
        >
          <p class="text-sm text-stone-600">
            {{ rental.status !== 'draft'
              ? 'Saving updates this booking. The new dates stay held for this equipment.'
              : rental.waiver
                ? 'Saving books this rental and holds these dates for this equipment.'
                : 'After the waiver is signed, saving books this rental and holds these dates.' }}
          </p>
          <UButton
            type="submit"
            class="w-full justify-center sm:w-auto"
            :loading="pending || quoting"
            :disabled="!quote?.canFulfill"
          >
            Save rental details
          </UButton>
        </div>
      </div>
    </form>
  </div>
</template>
