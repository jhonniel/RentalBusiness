<script setup lang="ts">
import type { PublicProduct } from '~/types/catalog'
import type { PublicRental, RentalQuote } from '~/types/rental'
import { fieldErrors } from '~/utils/auth-validation'
import { identityUploadFormData } from '~/utils/browser-image'
import { calendarDateInZone } from '~/utils/datetime'
import { IMAGE_UPLOAD_ACCEPT, IMAGE_UPLOAD_HELP } from '~/utils/image-upload'
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
const governmentFile = ref<File | null>(null)
const selfieFile = ref<File | null>(null)
const errors = ref<Record<string, string>>({})
const formError = ref('')
const pending = ref(false)
const created = ref<{ uuid: string, waiverUrl: string } | null>(null)
const quoting = ref(false)
const quote = ref<RentalQuote | null>(null)
const quoteError = ref('')

const customerQuery = computed(() => ({
  search: customerSearch.value || undefined,
  page: 1,
  pageSize: 50,
}))
const productQuery = computed(() => ({
  search: productSearch.value || undefined,
  status: 'active',
  page: 1,
  pageSize: 50,
}))

const { data: customers, error: customerError, pending: customersPending, execute: loadCustomers } = await useFetch<{ items: CustomerOption[] }>('/api/admin/customers', {
  query: customerQuery,
  immediate: false,
  watch: false,
})

watch(customerSearch, (value) => {
  if (value.trim()) {
    loadCustomers()
  }
})
const { data: products, error: productError, pending: productsPending, execute: loadProducts } = await useFetch<{ items: PublicProduct[] }>('/api/admin/products', {
  query: productQuery,
  immediate: false,
  watch: false,
})

watch(productSearch, (value) => {
  if (value.trim()) {
    loadProducts()
  }
})

const unavailable = computed(() => customerError.value?.statusCode === 503 || productError.value?.statusCode === 503)
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
  customerSearchInput.value = ''
}

function clearCustomer() {
  selectedCustomer.value = null
  form.firstName = ''
  form.lastName = ''
  form.phone = ''
  form.email = ''
}

function chooseProduct(product: PublicProduct) {
  selectedProduct.value = {
    uuid: product.uuid,
    slug: product.slug,
    name: product.name,
  }
  productSearchInput.value = ''
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

function onGovernmentChange(event: Event) {
  governmentFile.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

function onSelfieChange(event: Event) {
  selfieFile.value = (event.target as HTMLInputElement).files?.[0] ?? null
}

function requestErrorMessage(error: unknown, fallback: string) {
  const payload = typeof error === 'object' && error && 'data' in error
    ? (error as { data?: { message?: string } }).data
    : null
  return payload?.message || fallback
}

async function copyWaiverLink() {
  if (!created.value) {
    return
  }
  await navigator.clipboard.writeText(created.value.waiverUrl)
  toast.add({ title: 'Waiver link copied', color: 'success' })
}

async function onSubmit() {
  formError.value = ''
  const governmentId = governmentFile.value
  const selfie = selfieFile.value
  if ((governmentId && !selfie) || (!governmentId && selfie)) {
    formError.value = 'Upload both ID photos, or leave both empty so the customer can photograph them.'
    return
  }

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
    const rental = await $fetch<PublicRental & { waiverUrl: string | null }>('/api/admin/rentals', {
      method: 'POST',
      body: parsed.data,
    })
    if (governmentId && selfie) {
      try {
        await $fetch(`/api/admin/rentals/${rental.uuid}/identity`, {
          method: 'POST',
          body: await identityUploadFormData({
            governmentId,
            selfie,
          }),
        })
      }
      catch (error) {
        toast.add({
          title: requestErrorMessage(error, 'The booking was saved, but the ID photos were not. The customer can photograph them on the waiver link.'),
          color: 'error',
        })
      }
    }
    if (!rental.waiverUrl) {
      toast.add({
        title: 'Booking saved. Open it to create the waiver link.',
        color: 'error',
      })
      await navigateTo(`/admin/rentals/${rental.uuid}#waiver`)
      return
    }
    created.value = { uuid: rental.uuid, waiverUrl: rental.waiverUrl }
    toast.add({ title: 'Booking created', color: 'success' })
  }
  catch (error) {
    formError.value = requestErrorMessage(error, 'We could not create that booking.')
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-6xl space-y-6">
    <div class="flex flex-wrap items-end justify-between gap-4">
      <div>
        <NuxtLink
          to="/admin/rentals"
          class="text-sm text-stone-500 hover:text-stone-800"
        >
          Rentals
        </NuxtLink>
        <h2 class="mt-2 text-2xl font-medium tracking-tight text-stone-900">
          New booking
        </h2>
        <p class="mt-1 max-w-xl text-sm leading-6 text-stone-600">
          Choose the equipment and dates. Name, email, phone, and ID photos can wait. A waiver link is created for the customer to finish and sign.
        </p>
      </div>
    </div>

    <AdminNotice
      v-if="unavailable"
      title="Rentals are not connected"
      description="Add live Supabase credentials to create a booking."
    />

    <section
      v-else-if="created"
      class="max-w-xl rounded-xl border border-stone-200 bg-white p-5 shadow-sm"
    >
      <h3 class="text-lg font-medium text-stone-900">
        Waiver link
      </h3>
      <p class="mt-2 text-sm leading-6 text-stone-600">
        Send this link to the customer. They can change the dates, fill any missing name, email, or phone, photograph their ID if you did not upload it, then sign the waiver.
      </p>
      <p class="mt-4 break-all rounded-lg bg-stone-50 px-3 py-3 text-sm text-stone-800">
        {{ created.waiverUrl }}
      </p>
      <div class="mt-4 flex flex-wrap gap-2">
        <UButton
          type="button"
          @click="copyWaiverLink"
        >
          Copy link
        </UButton>
        <UButton
          :to="`/admin/rentals/${created.uuid}#waiver`"
          color="neutral"
          variant="outline"
        >
          Open booking
        </UButton>
      </div>
    </section>

    <form
      v-else
      class="grid items-start gap-6 xl:grid-cols-[minmax(0,36rem)_22rem]"
      method="post"
      @submit.prevent="onSubmit"
    >
      <div class="space-y-5">
        <AuthAlert
          v-if="formError"
          :description="formError"
        />

        <section class="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <div class="flex items-baseline justify-between gap-3">
            <h3 class="text-sm font-medium text-stone-900">
              Client
            </h3>
            <p class="text-xs text-stone-400">
              Step 1
            </p>
          </div>

          <p class="mt-3 text-sm text-stone-500">
            Optional. Leave these blank and the customer fills them on the waiver link.
          </p>
          <div class="mt-4 grid grid-cols-2 rounded-lg bg-stone-100 p-1">
            <button
              type="button"
              class="rounded-md px-3 py-2 text-sm font-medium"
              :class="clientMode === 'existing' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'"
              @click="clientMode = 'existing'"
            >
              Existing customer
            </button>
            <button
              type="button"
              class="rounded-md px-3 py-2 text-sm font-medium"
              :class="clientMode === 'new' ? 'bg-white text-stone-900 shadow-sm' : 'text-stone-600'"
              @click="clientMode = 'new'"
            >
              New client
            </button>
          </div>

          <div
            v-if="clientMode === 'existing'"
            class="mt-4 space-y-3"
          >
            <div
              v-if="selectedCustomer"
              class="flex items-center justify-between gap-3 rounded-lg border border-lumen-200 bg-lumen-50 px-3 py-3"
            >
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-stone-900">
                  {{ selectedCustomer.firstName }} {{ selectedCustomer.lastName }}
                </p>
                <p class="truncate text-xs text-stone-600">
                  {{ selectedCustomer.email || selectedCustomer.phone || 'No email on file' }}
                </p>
              </div>
              <button
                type="button"
                class="shrink-0 text-xs font-medium text-lumen-800"
                @click="clearCustomer"
              >
                Change
              </button>
            </div>

            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Find a customer</span>
              <input
                v-model="customerSearchInput"
                class="h-10 w-full rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none focus:border-stone-400"
                placeholder="Search by name"
                :disabled="pending"
              >
            </label>
            <p
              v-if="errors.email && !selectedCustomer"
              class="text-xs text-red-700"
            >
              Choose a customer, or switch to a new client and enter an email.
            </p>
            <p
              v-if="customerSearchInput.trim() && customerSearchInput.trim() !== customerSearch"
              class="text-sm text-stone-500"
            >
              Searching…
            </p>
            <p
              v-else-if="customerSearch && !customersPending && !customers?.items?.length"
              class="text-sm text-stone-500"
            >
              No customers match that search.
            </p>
            <ul
              v-if="customerSearchInput.trim() && customerSearch && customers?.items?.length"
              class="max-h-52 divide-y divide-stone-100 overflow-y-auto rounded-lg border border-stone-200"
            >
              <li
                v-for="customer in customers.items"
                :key="customer.uuid"
              >
                <button
                  type="button"
                  class="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-stone-50"
                  :class="selectedCustomer?.uuid === customer.uuid ? 'bg-lumen-50' : ''"
                  @click="chooseCustomer(customer)"
                >
                  <span class="min-w-0 truncate font-medium text-stone-900">{{ customer.firstName }} {{ customer.lastName }}</span>
                  <span class="shrink-0 truncate text-xs text-stone-500">{{ customer.email || customer.phone || 'No email' }}</span>
                </button>
              </li>
            </ul>
          </div>

          <div class="mt-4 grid max-w-xl gap-4 sm:grid-cols-2">
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">First name</span>
              <UInput
                v-model="form.firstName"
                class="w-full"
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
                class="w-full"
                :disabled="pending"
              />
              <span
                v-if="errors.lastName"
                class="mt-1 block text-xs text-red-700"
              >{{ errors.lastName }}</span>
            </label>
            <label
              v-if="clientMode === 'new'"
              class="block text-sm"
            >
              <span class="mb-1.5 block text-stone-700">Email</span>
              <UInput
                v-model="form.email"
                class="w-full"
                type="email"
                placeholder="client@email.com"
                :disabled="pending"
              />
              <span
                v-if="errors.email"
                class="mt-1 block text-xs text-red-700"
              >{{ errors.email }}</span>
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Phone number</span>
              <UInput
                v-model="form.phone"
                class="w-full"
                type="tel"
                placeholder="09…"
                :disabled="pending"
              />
            </label>
          </div>
        </section>

        <section class="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <div class="flex items-baseline justify-between gap-3">
            <h3 class="text-sm font-medium text-stone-900">
              Equipment
            </h3>
            <p class="text-xs text-stone-400">
              Step 2
            </p>
          </div>
          <div
            v-if="selectedProduct"
            class="mt-4 flex items-center justify-between gap-3 rounded-lg border border-lumen-200 bg-lumen-50 px-3 py-3"
          >
            <p class="min-w-0 truncate text-sm font-medium text-stone-900">
              {{ selectedProduct.name }}
            </p>
            <button
              type="button"
              class="shrink-0 text-xs font-medium text-lumen-800"
              @click="selectedProduct = null"
            >
              Change
            </button>
          </div>
          <label class="mt-4 block text-sm">
            <span class="mb-1.5 block text-stone-700">Find equipment</span>
            <input
              v-model="productSearchInput"
              class="h-10 w-full rounded-md border border-stone-200 bg-white px-3 text-sm text-stone-900 outline-none focus:border-stone-400"
              placeholder="Search by name"
              :disabled="pending"
            >
          </label>
          <p
            v-if="errors.productUuid"
            class="mt-2 text-xs text-red-700"
          >
            {{ errors.productUuid }}
          </p>
          <p
            v-if="productSearchInput.trim() && productSearchInput.trim() !== productSearch"
            class="mt-3 text-sm text-stone-500"
          >
            Searching…
          </p>
          <p
            v-else-if="productSearch && !productsPending && !products?.items?.length"
            class="mt-3 text-sm text-stone-500"
          >
            No equipment matches that search.
          </p>
          <ul
            v-if="productSearchInput.trim() && productSearch && products?.items?.length"
            class="mt-3 max-h-52 divide-y divide-stone-100 overflow-y-auto rounded-lg border border-stone-200"
          >
            <li
              v-for="product in products.items"
              :key="product.uuid"
            >
              <button
                type="button"
                class="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-sm hover:bg-stone-50"
                :class="selectedProduct?.uuid === product.uuid ? 'bg-lumen-50' : ''"
                @click="chooseProduct(product)"
              >
                <span class="min-w-0 truncate font-medium text-stone-900">{{ product.name }}</span>
                <span class="shrink-0 text-xs text-stone-500">{{ product.sku }}</span>
              </button>
            </li>
          </ul>
        </section>

        <section class="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <div class="flex items-baseline justify-between gap-3">
            <h3 class="text-sm font-medium text-stone-900">
              Schedule
            </h3>
            <p class="text-xs text-stone-400">
              Step 3
            </p>
          </div>
          <p
            v-if="!selectedProduct"
            class="mt-3 text-sm text-stone-500"
          >
            Choose the equipment first, then set the pickup and return.
          </p>
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
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
            <BookingDateField
              v-model="form.endsOn"
              label="Return date"
              :product-slug="selectedProduct?.slug"
              :quantity="form.quantity"
              :min="form.startsOn || undefined"
              :disabled="pending || !selectedProduct"
              flexible
            />
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Quantity</span>
              <UInput
                v-model.number="form.quantity"
                class="w-full"
                type="number"
                min="1"
                max="99"
                :disabled="pending"
              />
            </label>
          </div>
          <p class="mt-4 rounded-lg bg-stone-50 px-3 py-2 text-sm text-stone-700">
            Return {{ formatRentalReturnLabel(rentalWindow.endsOn, rentalWindow.pickupTime) }}
          </p>
          <p
            v-if="quoteError"
            class="mt-3 text-sm text-red-800"
          >
            {{ quoteError }}
          </p>
        </section>

        <section class="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <div class="flex items-baseline justify-between gap-3">
            <h3 class="text-sm font-medium text-stone-900">
              Identity documents
            </h3>
            <p class="text-xs text-stone-400">
              Step 4
            </p>
          </div>
          <p class="mt-2 text-sm leading-6 text-stone-500">
            Optional. If you leave these blank, the customer photographs them before they can sign. {{ IMAGE_UPLOAD_HELP }}
          </p>
          <div class="mt-4 grid gap-3 sm:grid-cols-2">
            <label
              class="flex cursor-pointer flex-col items-center rounded-lg border border-dashed px-4 py-5 text-center"
              :class="governmentFile ? 'border-lumen-300 bg-lumen-50' : 'border-stone-300 bg-stone-50 hover:border-stone-400'"
            >
              <span class="text-sm font-medium text-stone-900">Government ID</span>
              <span class="mt-1 line-clamp-2 text-xs text-stone-500">
                {{ governmentFile?.name || 'Choose a photo' }}
              </span>
              <input
                type="file"
                class="sr-only"
                :accept="IMAGE_UPLOAD_ACCEPT"
                :disabled="pending"
                @change="onGovernmentChange"
              >
            </label>
            <label
              class="flex cursor-pointer flex-col items-center rounded-lg border border-dashed px-4 py-5 text-center"
              :class="selfieFile ? 'border-lumen-300 bg-lumen-50' : 'border-stone-300 bg-stone-50 hover:border-stone-400'"
            >
              <span class="text-sm font-medium text-stone-900">Selfie with ID</span>
              <span class="mt-1 line-clamp-2 text-xs text-stone-500">
                {{ selfieFile?.name || 'Choose a photo' }}
              </span>
              <input
                type="file"
                class="sr-only"
                :accept="IMAGE_UPLOAD_ACCEPT"
                :disabled="pending"
                @change="onSelfieChange"
              >
            </label>
          </div>
        </section>

        <section class="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <label class="block text-sm">
            <span class="mb-1.5 block font-medium text-stone-900">Notes</span>
            <UTextarea
              v-model="form.notes"
              class="w-full max-w-xl"
              :rows="3"
              placeholder="Pickup instructions or anything the shop should remember"
              :disabled="pending"
            />
          </label>
        </section>
      </div>

      <aside class="space-y-4 xl:sticky xl:top-6">
        <section class="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 class="text-sm font-medium text-stone-900">
            Summary
          </h3>
          <dl
            v-if="quote"
            class="mt-4 space-y-3 text-sm"
          >
            <div class="flex justify-between gap-4">
              <dt class="text-stone-500">Equipment</dt>
              <dd class="max-w-[12rem] truncate text-right text-stone-800">
                {{ selectedProduct?.name }}
              </dd>
            </div>
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
              <dt class="text-stone-500">Less</dt>
              <dd>−{{ formatMoney(quote.lessAmount) }}</dd>
            </div>
            <div class="flex justify-between gap-4">
              <dt class="text-stone-500">Deposit</dt>
              <dd>{{ formatMoney(quote.depositAmount) }}</dd>
            </div>
            <div class="flex justify-between gap-4 border-t border-stone-100 pt-3 font-medium text-stone-900">
              <dt>Amount due</dt>
              <dd>{{ formatMoney(quote.totalAmount + quote.depositAmount) }}</dd>
            </div>
          </dl>
          <p
            v-else
            class="mt-4 text-sm leading-6 text-stone-500"
          >
            Choose equipment and dates to see the amount due.
          </p>
          <p
            v-if="quote"
            class="mt-4 text-sm"
            :class="quote.canFulfill ? 'text-lumen-800' : 'text-red-800'"
          >
            {{ quote.canFulfill
              ? `${quote.available} units are free for these dates.`
              : 'That quantity is not available for these dates.' }}
          </p>
          <div class="mt-5 flex flex-col gap-2">
            <UButton
              type="submit"
              block
              :loading="pending || quoting"
              :disabled="!quote?.canFulfill"
            >
              Create booking
            </UButton>
            <UButton
              to="/admin/rentals"
              block
              color="neutral"
              variant="ghost"
            >
              Cancel
            </UButton>
          </div>
        </section>
      </aside>
    </form>
  </div>
</template>
