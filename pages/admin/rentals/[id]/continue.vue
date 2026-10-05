<script setup lang="ts">
import type { PublicRental, RentalQuote } from '~/types/rental'
import { fieldErrors } from '~/utils/auth-validation'
import { calendarDateInZone } from '~/utils/datetime'
import { continueAdminRentalSchema } from '~/utils/rental-validation'
import { defaultRentalReturnOn, formatRentalReturnLabel, normalizePickupTime, resolveRentalWindow } from '~/utils/rental-window'
import { canContinueAdminRental, canOpenAdminContinue } from '~/utils/waiver-invite'

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
})
const errors = ref<Record<string, string>>({})
const formError = ref('')
const quoteError = ref('')
const pending = ref(false)
const quoting = ref(false)
const quote = ref<RentalQuote | null>(null)

const rentalWindow = computed(() => resolveRentalWindow({
  startsOn: form.startsOn,
  endsOn: form.endsOn,
  pickupTime: form.pickupTime,
}))
const productSlug = computed(() => rental.value?.items[0]?.product.slug || '')
const canContinue = computed(() => rental.value ? canContinueAdminRental(rental.value) : false)
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
}, { immediate: true })

watch(() => form.startsOn, (value, previous) => {
  if (!value) {
    return
  }
  if (form.endsOn <= value || (previous && form.endsOn === defaultRentalReturnOn(previous))) {
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
    quote.value = await $fetch<RentalQuote>('/api/admin/rentals/quote', {
      method: 'POST',
      body: {
        productSlug: productSlug.value,
        startsOn: form.startsOn,
        endsOn: form.endsOn,
        pickupTime: form.pickupTime,
        quantity: form.quantity,
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
  () => [form.startsOn, form.endsOn, form.pickupTime, form.quantity, productSlug.value],
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
    toast.add({ title: 'Rental details saved', color: 'success' })
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
        Finish the customer details. Copy the waiver link and send it to the customer — they can open it without an account, agree to the terms, and sign.
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
            You can change the pickup date, return date, and pickup time. Return stays at the same clock on the return date.
          </p>
          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            <BookingDateField
              v-model="form.startsOn"
              label="Pickup date"
              :product-slug="productSlug || undefined"
              :quantity="form.quantity"
              :until="form.endsOn || undefined"
              :disabled="pending || !canContinue"
              flexible
            />
            <BookingPickupTime
              v-model="form.pickupTime"
              :product-slug="productSlug || undefined"
              :starts-on="form.startsOn"
              :ends-on="form.endsOn"
              :own-pickup-at="rental.pickupAt"
              :own-return-at="rental.returnAt"
              :disabled="pending || !canContinue"
              flexible
            />
            <BookingDateField
              v-model="form.endsOn"
              label="Return date"
              :product-slug="productSlug || undefined"
              :quantity="form.quantity"
              :min="form.startsOn || undefined"
              :disabled="pending || !canContinue"
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
              <dd>{{ formatMoney(quote.lineTotal) }}</dd>
            </div>
            <div class="flex justify-between gap-4 font-medium text-stone-900">
              <dt>Rental total</dt>
              <dd>{{ formatMoney(quote.totalAmount) }}</dd>
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
                :disabled="pending || !canContinue"
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
                :disabled="pending || !canContinue"
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
                :disabled="pending || !canContinue"
              />
            </label>
            <label class="block text-sm sm:col-span-2">
              <span class="mb-1.5 block text-stone-700">Notes</span>
              <UTextarea
                v-model="form.notes"
                :rows="3"
                :disabled="pending || !canContinue"
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

        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="canContinue"
            type="submit"
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
