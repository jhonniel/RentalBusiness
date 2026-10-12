<script setup lang="ts">
import type { PublicProduct } from '~/types/catalog'
import type { PublicRental, RentalQuote } from '~/types/rental'
import { fieldErrors } from '~/utils/auth-validation'
import { calendarDateInZone } from '~/utils/datetime'
import { createAdminRentalSchema } from '~/utils/rental-validation'
import { DEFAULT_PICKUP_TIME, defaultRentalReturnOn, formatRentalReturnLabel, resolveRentalWindow } from '~/utils/rental-window'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'New booking',
  path: '/admin/rentals/new',
})

type CustomerOption = {
  uuid: string
  firstName: string
  lastName: string
  email: string | null
  phone: string | null
}

const today = calendarDateInZone()
const toast = useToast()
const { formatMoney } = useCurrency()
const clientMode = ref<'existing' | 'new'>('existing')
const customerSearchInput = ref('')
const customerSearch = refDebounced(customerSearchInput, 300)
const productSearchInput = ref('')
const productSearch = refDebounced(productSearchInput, 300)
const selectedCustomer = ref<CustomerOption | null>(null)
const selectedProduct = ref<Pick<PublicProduct, 'uuid' | 'slug' | 'name'> | null>(null)
const form = reactive({
  startsOn: today,
  endsOn: defaultRentalReturnOn(today),
  pickupTime: DEFAULT_PICKUP_TIME,
  quantity: 1,
  firstName: '',
  lastName: '',
  phone: '',
  email: '',
  notes: '',
})
const errors = ref<Record<string, string>>({})
const formError = ref('')
const pending = ref(false)
const quoting = ref(false)
const quote = ref<RentalQuote | null>(null)
const quoteError = ref('')

const customerQuery = computed(() => ({
  search: customerSearch.value || undefined,
  page: 1,
  pageSize: 8,
}))
const productQuery = computed(() => ({
  search: productSearch.value || undefined,
  status: 'active',
  page: 1,
  pageSize: 50,
}))

const { data: customers, error: customerError } = await useFetch<{ items: CustomerOption[] }>('/api/admin/customers', {
  query: customerQuery,
  watch: [customerQuery],
})
const { data: products, error: productError } = await useFetch<{ items: PublicProduct[] }>('/api/admin/products', {
  query: productQuery,
  watch: [productQuery],
})

const unavailable = computed(() => customerError.value?.statusCode === 503 || productError.value?.statusCode === 503)
const rentalWindow = computed(() => resolveRentalWindow({
  startsOn: form.startsOn,
  endsOn: form.endsOn,
  pickupTime: form.pickupTime,
}))

watch(() => form.startsOn, (value, previous) => {
  if (form.endsOn <= value || (previous && form.endsOn === defaultRentalReturnOn(previous))) {
    form.endsOn = defaultRentalReturnOn(value)
  }
})

watch(clientMode, (mode) => {
  if (mode === 'new') {
    selectedCustomer.value = null
  }
})

function chooseCustomer(customer: CustomerOption) {
  selectedCustomer.value = customer
  form.firstName = customer.firstName
  form.lastName = customer.lastName
  form.phone = customer.phone || ''
  form.email = customer.email || ''
}

function chooseProduct(product: PublicProduct) {
  selectedProduct.value = {
    uuid: product.uuid,
    slug: product.slug,
    name: product.name,
  }
}

async function refreshQuote() {
  if (!selectedProduct.value) {
    quote.value = null
    return
  }

  quoting.value = true
  quoteError.value = ''
  try {
    quote.value = await $fetch<RentalQuote>('/api/admin/rentals/quote', {
      method: 'POST',
      body: {
        productUuid: selectedProduct.value.uuid,
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

watch(
  () => [selectedProduct.value?.uuid, form.startsOn, form.endsOn, form.pickupTime, form.quantity].join('|'),
  () => {
    refreshQuote()
  },
)

async function onSubmit() {
  formError.value = ''
  const parsed = createAdminRentalSchema.safeParse({
    productUuid: selectedProduct.value?.uuid,
    startsOn: form.startsOn,
    endsOn: form.endsOn,
    pickupTime: form.pickupTime,
    quantity: form.quantity,
    notes: form.notes,
    customerUuid: clientMode.value === 'existing' ? selectedCustomer.value?.uuid : undefined,
    firstName: form.firstName,
    lastName: form.lastName,
    phone: form.phone,
    email: clientMode.value === 'new' ? form.email : undefined,
  })

  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error)
    return
  }

  errors.value = {}
  pending.value = true
  try {
    const rental = await $fetch<PublicRental>('/api/admin/rentals', {
      method: 'POST',
      body: parsed.data,
    })
    toast.add({ title: 'Booking created', color: 'success' })
    await navigateTo(`/admin/rentals/${rental.uuid}#waiver`)
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not create that booking.'
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="w-full space-y-6">
    <div>
      <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
        Operations
      </p>
      <h2 class="mt-2 text-2xl font-medium text-stone-900">
        New booking
      </h2>
      <p class="mt-1 max-w-2xl text-sm text-stone-600">
        Create a draft for a client. On the next page, send the waiver link so they can open it and sign without an account.
      </p>
    </div>

    <AdminNotice
      v-if="unavailable"
      title="Rentals are not connected"
      description="Add live Supabase credentials to create a booking."
    />

    <form
      v-else
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
            Client
          </h3>
          <div class="mt-4 flex flex-wrap gap-2">
            <UButton
              type="button"
              size="sm"
              :variant="clientMode === 'existing' ? 'solid' : 'outline'"
              @click="clientMode = 'existing'"
            >
              Existing customer
            </UButton>
            <UButton
              type="button"
              size="sm"
              :variant="clientMode === 'new' ? 'solid' : 'outline'"
              @click="clientMode = 'new'"
            >
              New client
            </UButton>
          </div>

          <div
            v-if="clientMode === 'existing'"
            class="mt-4 space-y-3"
          >
            <input
              v-model="customerSearchInput"
              class="w-full rounded-md border border-stone-200 px-3 py-2 text-sm"
              placeholder="Search name"
              :disabled="pending"
            >
            <p
              v-if="selectedCustomer"
              class="text-sm text-stone-700"
            >
              Selected: {{ selectedCustomer.firstName }} {{ selectedCustomer.lastName }}
              <span v-if="selectedCustomer.email"> · {{ selectedCustomer.email }}</span>
            </p>
            <p
              v-if="errors.email && !selectedCustomer"
              class="text-xs text-red-700"
            >
              Choose a customer, or switch to a new client and enter an email.
            </p>
            <ul
              v-if="customers?.items?.length"
              class="divide-y divide-stone-100 rounded-lg border border-stone-100"
            >
              <li
                v-for="customer in customers.items"
                :key="customer.uuid"
              >
                <button
                  type="button"
                  class="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-stone-50"
                  :class="selectedCustomer?.uuid === customer.uuid ? 'bg-lumen-50' : ''"
                  @click="chooseCustomer(customer)"
                >
                  <span>{{ customer.firstName }} {{ customer.lastName }}</span>
                  <span class="text-stone-500">{{ customer.email || customer.phone || 'No email' }}</span>
                </button>
              </li>
            </ul>
          </div>

          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <label
              v-if="clientMode === 'new'"
              class="block text-sm sm:col-span-2"
            >
              <span class="mb-1.5 block text-stone-700">Email</span>
              <UInput
                v-model="form.email"
                type="email"
                :disabled="pending"
              />
              <span
                v-if="errors.email"
                class="mt-1 block text-xs text-red-700"
              >{{ errors.email }}</span>
            </label>
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
                :disabled="pending"
              />
            </label>
          </div>
        </section>

        <section class="rounded-xl border border-stone-200 bg-white p-5">
          <h3 class="text-sm font-medium text-stone-900">
            Equipment
          </h3>
          <input
            v-model="productSearchInput"
            class="mt-4 w-full rounded-md border border-stone-200 px-3 py-2 text-sm"
            placeholder="Search equipment"
            :disabled="pending"
          >
          <p
            v-if="selectedProduct"
            class="mt-3 text-sm text-stone-700"
          >
            Selected: {{ selectedProduct.name }}
          </p>
          <p
            v-if="errors.productUuid"
            class="mt-2 text-xs text-red-700"
          >
            {{ errors.productUuid }}
          </p>
          <ul
            v-if="products?.items?.length"
            class="mt-3 max-h-56 divide-y divide-stone-100 overflow-y-auto rounded-lg border border-stone-100"
          >
            <li
              v-for="product in products.items"
              :key="product.uuid"
            >
              <button
                type="button"
                class="w-full px-3 py-2 text-left text-sm hover:bg-stone-50"
                :class="selectedProduct?.uuid === product.uuid ? 'bg-lumen-50' : ''"
                @click="chooseProduct(product)"
              >
                {{ product.name }}
              </button>
            </li>
          </ul>
        </section>
      </div>

      <div class="space-y-6">
        <section class="rounded-xl border border-stone-200 bg-white p-5">
          <h3 class="text-sm font-medium text-stone-900">
            Pickup and return
          </h3>
          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            <BookingDateField
              v-model="form.startsOn"
              label="Pickup date"
              :product-slug="selectedProduct?.slug"
              :quantity="form.quantity"
              :until="form.endsOn || undefined"
              :disabled="pending || !selectedProduct"
              flexible
            />
            <BookingPickupTime
              v-model="form.pickupTime"
              :product-slug="selectedProduct?.slug"
              :starts-on="form.startsOn"
              :ends-on="form.endsOn"
              :disabled="pending || !selectedProduct"
              flexible
            />
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Quantity</span>
              <UInput
                v-model.number="form.quantity"
                type="number"
                min="1"
                max="99"
                :disabled="pending"
              />
            </label>
            <BookingDateField
              v-model="form.endsOn"
              label="Return date"
              :product-slug="selectedProduct?.slug"
              :quantity="form.quantity"
              :min="form.startsOn || undefined"
              :disabled="pending || !selectedProduct"
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

        <section class="rounded-xl border border-stone-200 bg-white p-5">
          <label class="block text-sm">
            <span class="mb-1.5 block text-stone-700">Notes</span>
            <UTextarea
              v-model="form.notes"
              :rows="3"
              :disabled="pending"
            />
          </label>
        </section>

        <div class="flex flex-wrap gap-2">
          <UButton
            type="submit"
            :loading="pending || quoting"
            :disabled="!quote?.canFulfill"
          >
            Create booking
          </UButton>
          <UButton
            to="/admin/rentals"
            color="neutral"
            variant="ghost"
          >
            Cancel
          </UButton>
        </div>
      </div>
    </form>
  </div>
</template>
