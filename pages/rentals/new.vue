<script setup lang="ts">
import type { CatalogProduct } from '~/types/catalog'
import type { RentalQuote, PublicRental } from '~/types/rental'
import { fieldErrors } from '~/utils/auth-validation'
import { calendarDateInZone, formatBookingDateRange, formatBusinessDateTime } from '~/utils/datetime'
import { createRentalSchema } from '~/utils/rental-validation'
import { DEFAULT_PICKUP_TIME, defaultRentalReturnOn, formatRentalReturnLabel, resolveRentalWindow } from '~/utils/rental-window'
import { productVisual, resolvedProductImage } from '~/utils/storefront'

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
  endsOn: typeof route.query.endsOn === 'string'
    ? route.query.endsOn
    : defaultRentalReturnOn(typeof route.query.startsOn === 'string' ? route.query.startsOn : today),
  pickupTime: typeof route.query.pickupTime === 'string' ? route.query.pickupTime : DEFAULT_PICKUP_TIME,
  quantity: 1,
  firstName: '',
  lastName: '',
  phone: '',
  notes: '',
})
if (form.endsOn <= form.startsOn) {
  form.endsOn = defaultRentalReturnOn(form.startsOn)
}
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
const productImage = ref('')
watch(product, (value) => {
  productImage.value = value
    ? resolvedProductImage(value.slug, value.category.slug, value.images[0]?.url)
    : ''
}, { immediate: true })

function useImageFallback() {
  if (product.value) {
    productImage.value = productVisual(product.value.slug, product.value.category.slug)
  }
}
const rentalWindow = computed(() => resolveRentalWindow({
  startsOn: form.startsOn,
  endsOn: form.endsOn,
  pickupTime: form.pickupTime,
}))

watch(() => form.startsOn, (value, previous) => {
  if (!value) {
    return
  }
  if (!form.endsOn || form.endsOn <= value || (previous && form.endsOn === defaultRentalReturnOn(previous))) {
    form.endsOn = defaultRentalReturnOn(value)
  }
})

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
    formError.value = payload?.message || 'We could not price those dates.'
  }
  finally {
    quoting.value = false
  }
}

watchDebounced(
  () => [form.startsOn, form.endsOn, form.pickupTime, form.quantity, form.productSlug, product.value?.comingSoon],
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
  <section class="mx-auto max-w-6xl px-3 py-6 sm:px-6 sm:py-10 lg:px-8">
    <div class="flex flex-col gap-6 border-b border-[#12201a]/8 pb-6 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#5b6b64]">
          Booking
        </p>
        <h1 class="mt-2 text-2xl font-semibold tracking-tight text-[#12201a] sm:text-3xl">
          Request a rental
        </h1>
        <p class="mt-2 max-w-xl text-sm leading-6 text-[#5b6b64]">
          Choose your pickup and return, then confirm your details. You will sign the waiver and photograph a government ID before the request is sent to the shop.
        </p>
      </div>
      <BookingSteps
        :current="0"
        class="lg:min-w-[26rem]"
      />
    </div>

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
      class="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start"
      method="post"
      @submit.prevent="onSubmit"
    >
      <div class="min-w-0 space-y-6">
        <AuthAlert
          v-if="formError"
          :description="formError"
        />

        <section class="storefront-card rounded-2xl p-5 sm:p-6">
          <div class="flex items-start gap-3">
            <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#12201a] text-xs font-semibold text-white">1</span>
            <div class="min-w-0">
              <h2 class="font-semibold text-[#12201a]">
                Pickup and return
              </h2>
              <p class="mt-0.5 text-sm text-[#5b6b64]">
                Crossed-out days are already booked. Return is at the same time as pickup.
              </p>
            </div>
          </div>
          <div class="mt-5 grid gap-4 sm:grid-cols-3">
            <BookingDateField
              v-model="form.startsOn"
              label="Pickup date"
              :product-slug="form.productSlug || undefined"
              :quantity="1"
              :until="form.endsOn || undefined"
              :disabled="pending"
            />
            <BookingPickupTime
              v-model="form.pickupTime"
              :product-slug="form.productSlug || undefined"
              :starts-on="form.startsOn"
              :ends-on="form.endsOn"
              :disabled="pending"
            />
            <BookingDateField
              v-model="form.endsOn"
              label="Return date"
              :product-slug="form.productSlug || undefined"
              :quantity="1"
              :min="form.startsOn || undefined"
              :disabled="pending"
            />
          </div>
          <div class="mt-4 flex items-center gap-2 rounded-xl bg-[#f4f6f5] px-3.5 py-2.5 text-sm text-[#12201a]">
            <UIcon
              name="i-lucide-clock"
              class="size-4 shrink-0 text-[#5b6b64]"
            />
            <span>Return {{ formatRentalReturnLabel(rentalWindow.endsOn, rentalWindow.pickupTime) }}</span>
          </div>
        </section>

        <section class="storefront-card rounded-2xl p-5 sm:p-6">
          <div class="flex items-start gap-3">
            <span class="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#12201a] text-xs font-semibold text-white">2</span>
            <div class="min-w-0">
              <h2 class="font-semibold text-[#12201a]">
                Your details
              </h2>
              <p class="mt-0.5 text-sm text-[#5b6b64]">
                The shop uses these to confirm your booking and arrange pickup.
              </p>
            </div>
          </div>
          <div class="mt-5 grid gap-4 sm:grid-cols-2">
            <label class="block text-sm">
              <span class="mb-1.5 block text-xs font-medium text-[#5b6b64]">First name</span>
              <UInput
                v-model="form.firstName"
                size="lg"
                class="w-full"
                autocomplete="given-name"
                :disabled="pending"
              />
              <span
                v-if="errors.firstName"
                class="mt-1 block text-xs text-red-700"
              >{{ errors.firstName }}</span>
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block text-xs font-medium text-[#5b6b64]">Last name</span>
              <UInput
                v-model="form.lastName"
                size="lg"
                class="w-full"
                autocomplete="family-name"
                :disabled="pending"
              />
              <span
                v-if="errors.lastName"
                class="mt-1 block text-xs text-red-700"
              >{{ errors.lastName }}</span>
            </label>
            <label class="block text-sm sm:col-span-2">
              <span class="mb-1.5 block text-xs font-medium text-[#5b6b64]">Mobile number</span>
              <UInput
                v-model="form.phone"
                size="lg"
                class="w-full"
                type="tel"
                autocomplete="tel"
                placeholder="09XX XXX XXXX"
                :disabled="pending"
              />
              <span
                v-if="errors.phone"
                class="mt-1 block text-xs text-red-700"
              >{{ errors.phone }}</span>
            </label>
            <label class="block text-sm sm:col-span-2">
              <span class="mb-1.5 block text-xs font-medium text-[#5b6b64]">Notes for the shop <span class="font-normal">(optional)</span></span>
              <UTextarea
                v-model="form.notes"
                class="w-full"
                :rows="3"
                placeholder="Where you will use it, pickup questions, or anything we should know"
                :disabled="pending"
              />
            </label>
          </div>
        </section>
      </div>

      <aside class="storefront-card overflow-hidden rounded-2xl lg:sticky lg:top-24">
        <div class="flex items-center gap-4 border-b border-[#12201a]/8 p-5">
          <div class="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#f4f6f5]">
            <img
              v-if="productImage"
              :src="productImage"
              :alt="product?.name || ''"
              class="h-full w-full object-contain p-1.5"
              @error="useImageFallback"
            >
          </div>
          <div class="min-w-0">
            <p class="text-xs text-[#5b6b64]">
              {{ product?.category.name || 'Equipment' }}
            </p>
            <p class="mt-0.5 font-semibold leading-snug text-[#12201a]">
              {{ product?.name || form.productSlug }}
            </p>
            <NuxtLink
              :to="`/products/${form.productSlug}`"
              class="mt-1 inline-block text-xs text-[#5b6b64] underline-offset-2 hover:text-[#12201a] hover:underline"
            >
              View details
            </NuxtLink>
          </div>
        </div>

        <div class="space-y-4 p-5">
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between gap-4">
              <dt class="text-[#5b6b64]">
                Dates
              </dt>
              <dd class="text-right text-[#12201a]">
                {{ formatBookingDateRange(rentalWindow.startsOn, rentalWindow.endsOn) }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-[#5b6b64]">
                Pickup
              </dt>
              <dd class="text-right text-[#12201a]">
                {{ formatBusinessDateTime(rentalWindow.pickupAt) }}
              </dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-[#5b6b64]">
                Return
              </dt>
              <dd class="text-right text-[#12201a]">
                {{ formatBusinessDateTime(rentalWindow.returnAt) }}
              </dd>
            </div>
          </dl>

          <div
            v-if="quoting && !quote"
            class="space-y-2"
            role="status"
            aria-busy="true"
          >
            <USkeleton class="h-4 w-full" />
            <USkeleton class="h-4 w-3/4" />
            <USkeleton class="h-6 w-full" />
          </div>

          <template v-else-if="quote">
            <dl class="space-y-2 border-t border-dashed border-[#12201a]/12 pt-4 text-sm">
              <div class="flex justify-between gap-4">
                <dt class="text-[#5b6b64]">
                  Rent · {{ quote.days }} day{{ quote.days === 1 ? '' : 's' }}
                </dt>
                <dd class="tabular-nums text-[#12201a]">
                  {{ formatMoney(quote.rentAmount) }}
                </dd>
              </div>
              <div
                v-if="quote.lessAmount > 0"
                class="flex justify-between gap-4"
              >
                <dt class="text-[#5b6b64]">
                  Less
                </dt>
                <dd class="tabular-nums text-emerald-700">
                  −{{ formatMoney(quote.lessAmount) }}
                </dd>
              </div>
              <div class="flex justify-between gap-4">
                <dt class="text-[#5b6b64]">
                  Refundable deposit
                </dt>
                <dd class="tabular-nums text-[#12201a]">
                  {{ formatMoney(quote.depositAmount) }}
                </dd>
              </div>
            </dl>
            <div class="flex items-end justify-between gap-4 border-t border-[#12201a]/8 pt-4">
              <span class="text-sm font-medium text-[#12201a]">Amount due</span>
              <span class="text-2xl font-semibold tabular-nums text-[#12201a]">
                {{ formatMoney(quote.totalAmount + quote.depositAmount) }}
              </span>
            </div>
            <p
              class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm"
              :class="quote.canFulfill ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-800'"
            >
              <UIcon
                :name="quote.canFulfill ? 'i-lucide-circle-check' : 'i-lucide-circle-alert'"
                class="size-4 shrink-0"
              />
              {{ quote.canFulfill ? 'Available for these dates' : 'Not available for these dates. Try other dates.' }}
            </p>
          </template>

          <p
            v-else
            class="rounded-xl bg-[#f4f6f5] px-3 py-2 text-sm text-[#5b6b64]"
          >
            Choose your dates to see the price.
          </p>

          <UButton
            type="submit"
            size="lg"
            block
            class="rounded-full"
            :loading="pending || quoting"
            :disabled="!quote?.canFulfill"
          >
            Continue to waiver
            <UIcon
              name="i-lucide-arrow-right"
              class="size-4"
            />
          </UButton>
          <p class="text-center text-xs leading-5 text-[#5b6b64]">
            You will not pay yet. The shop confirms your request after the waiver and ID are done.
          </p>
        </div>
      </aside>
    </form>
  </section>
</template>
