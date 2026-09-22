<script setup lang="ts">
import type { CatalogProduct } from '~/types/catalog'
import type { RentalQuote, PublicRental } from '~/types/rental'
import { fieldErrors } from '~/utils/auth-validation'
import { calendarDateInZone } from '~/utils/datetime'
import { createRentalSchema } from '~/utils/rental-validation'

definePageMeta({
  layout: 'account',
  middleware: 'auth',
})

const route = useRoute()
const { profile, authHeaders } = useAuth()
const { formatMoney } = useCurrency()
const toast = useToast()
const today = calendarDateInZone()

const form = reactive({
  productSlug: typeof route.query.product === 'string' ? route.query.product : '',
  startsOn: typeof route.query.startsOn === 'string' ? route.query.startsOn : today,
  endsOn: typeof route.query.endsOn === 'string' ? route.query.endsOn : today,
  quantity: 1,
  firstName: '',
  lastName: '',
  phone: '',
  notes: '',
})
const errors = ref<Record<string, string>>({})
const formError = ref('')
const pending = ref(false)
const quoting = ref(false)
const quote = ref<RentalQuote | null>(null)

useSiteMeta({
  title: 'Request a rental',
  path: '/rentals/new',
})

watch(profile, (value) => {
  if (!value) {
    return
  }
  form.firstName = value.firstName
  form.lastName = value.lastName
  form.phone = value.phone ?? ''
}, { immediate: true })

const { data: product, error: productError } = await useFetch<CatalogProduct>(
  () => `/api/products/${form.productSlug}`,
  { immediate: Boolean(form.productSlug) },
)

const unavailable = computed(() => productError.value?.statusCode === 503)

async function refreshQuote() {
  if (!form.productSlug || !form.startsOn || !form.endsOn) {
    return
  }

  quoting.value = true
  formError.value = ''
  try {
    quote.value = await $fetch<RentalQuote>('/api/rentals/quote', {
      method: 'POST',
      headers: authHeaders(),
      body: {
        productSlug: form.productSlug,
        startsOn: form.startsOn,
        endsOn: form.endsOn,
        quantity: form.quantity,
      },
    })
  }
  catch (error) {
    quote.value = null
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not price those dates.'
  }
  finally {
    quoting.value = false
  }
}

watchDebounced(
  () => [form.startsOn, form.endsOn, form.quantity, form.productSlug, product.value?.comingSoon],
  () => {
    if (product.value?.comingSoon) {
      quote.value = null
      return
    }
    void refreshQuote()
  },
  { debounce: 300, immediate: true },
)

async function onSubmit() {
  formError.value = ''
  errors.value = {}

  const parsed = createRentalSchema.safeParse({
    ...form,
    status: 'draft',
  })

  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error)
    formError.value = parsed.error.issues[0]?.message || 'Please check the submitted information.'
    return
  }

  pending.value = true
  try {
    const rental = await $fetch<PublicRental>('/api/rentals', {
      method: 'POST',
      headers: authHeaders(),
      body: parsed.data,
    })
    toast.add({ title: 'Continue to the waiver', color: 'success' })
    await navigateTo(`/rentals/${rental.code}/waiver`)
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not save those rental details.'
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="mx-auto max-w-3xl px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
    <h1 class="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
      Request a rental
    </h1>
    <p class="mt-2 text-stone-600">
      Confirm dates and your contact details. You will sign the waiver and upload a government ID before this request is sent.
    </p>

    <CatalogNotice
      v-if="unavailable"
      class="mt-8"
      title="Catalog is not connected"
      description="Add live Supabase credentials to submit a rental request."
    />

    <CatalogNotice
      v-else-if="!form.productSlug"
      class="mt-8"
      title="Choose equipment first"
      description="Open a product and continue from the date check."
    >
      <UButton to="/products">
        Browse equipment
      </UButton>
    </CatalogNotice>

    <CatalogNotice
      v-else-if="product?.comingSoon"
      class="mt-8"
      title="Coming soon"
      description="This kit is not open for booking yet. Check back when it is listed as available."
    >
      <UButton
        :to="`/products/${form.productSlug}`"
        color="neutral"
        variant="outline"
      >
        View kit
      </UButton>
    </CatalogNotice>

    <form
      v-else
      class="mt-8 space-y-6"
      method="post"
      @submit.prevent="onSubmit"
    >
      <AuthAlert
        v-if="formError"
        :description="formError"
      />

      <section class="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 class="text-sm font-medium text-stone-900">
          Equipment
        </h2>
        <p class="mt-2 text-stone-700">
          {{ product?.name || form.productSlug }}
        </p>
      </section>

      <section class="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 class="text-sm font-medium text-stone-900">
          Dates
        </h2>
        <div class="mt-4 grid gap-3 sm:grid-cols-2">
          <BookingDateField
            v-model="form.startsOn"
            label="Start date"
            :product-slug="form.productSlug || undefined"
            :quantity="1"
            :until="form.endsOn || undefined"
            :disabled="pending"
          />
          <BookingDateField
            v-model="form.endsOn"
            label="End date"
            :product-slug="form.productSlug || undefined"
            :quantity="1"
            :min="form.startsOn || undefined"
            :disabled="pending"
          />
        </div>
      </section>

      <section
        v-if="quote"
        class="rounded-2xl border border-stone-200 bg-white p-5"
      >
        <h2 class="text-sm font-medium text-stone-900">
          Summary
        </h2>
        <dl class="mt-4 space-y-2 text-sm">
          <div class="flex justify-between gap-4">
            <dt class="text-stone-500">
              {{ quote.days }} day{{ quote.days === 1 ? '' : 's' }}
            </dt>
            <dd>{{ formatMoney(quote.lineTotal) }}</dd>
          </div>
          <div class="flex justify-between gap-4">
            <dt class="text-stone-500">
              Deposit
            </dt>
            <dd>{{ formatMoney(quote.depositAmount) }}</dd>
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

      <section class="rounded-2xl border border-stone-200 bg-white p-5">
        <h2 class="text-sm font-medium text-stone-900">
          Your details
        </h2>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="mb-1.5 block text-stone-700">First name</span>
            <UInput
              v-model="form.firstName"
              :disabled="pending"
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
              :disabled="pending"
            />
          </label>
          <label class="block text-sm sm:col-span-2">
            <span class="mb-1.5 block text-stone-700">Phone</span>
            <UInput
              v-model="form.phone"
              type="tel"
              :disabled="pending"
            />
          </label>
          <label class="block text-sm sm:col-span-2">
            <span class="mb-1.5 block text-stone-700">Notes</span>
            <UTextarea
              v-model="form.notes"
              :rows="3"
              :disabled="pending"
            />
          </label>
        </div>
      </section>

      <UButton
        type="button"
        class="w-full sm:w-auto"
        :loading="pending || quoting"
        :disabled="!quote?.canFulfill"
        @click="onSubmit"
      >
        Continue to waiver
      </UButton>
    </form>
  </section>
</template>
