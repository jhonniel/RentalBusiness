<script setup lang="ts">
import type { PublicCategory, PublicProduct } from '~/types/catalog'
import { PRICE_FIELD_KEYS, PRODUCT_STATUSES, type PriceFieldKey } from '~/utils/constants'
import { fieldErrors } from '~/utils/auth-validation'
import { isPriceFieldHidden } from '~/utils/price-visibility'
import { productInputSchema } from '~/utils/product-validation'
import { slugify } from '~/utils/slug'

const props = defineProps<{
  product?: PublicProduct
  categories: PublicCategory[]
}>()

const emit = defineEmits<{
  saved: [uuid: string]
}>()

const toast = useToast()
const { authHeaders } = useAuth()
const pending = ref(false)
const formError = ref('')
const errors = ref<Record<string, string>>({})

const form = reactive({
  name: props.product?.name ?? '',
  sku: props.product?.sku ?? '',
  categoryUuid: props.product?.category.uuid ?? '',
  shortDescription: props.product?.shortDescription ?? '',
  description: props.product?.description ?? '',
  dailyPrice: props.product?.dailyPrice ?? 0,
  weeklyPrice: props.product?.weeklyPrice ?? '',
  monthlyPrice: props.product?.monthlyPrice ?? '',
  depositAmount: props.product?.depositAmount ?? 0,
  lateFee: props.product?.lateFee ?? 0,
  replacementValue: props.product?.replacementValue ?? '',
  hideOnStorefront: Object.fromEntries(
    PRICE_FIELD_KEYS.map(key => [key, isPriceFieldHidden(props.product?.hiddenPriceFields ?? [], key)]),
  ) as Record<PriceFieldKey, boolean>,
  quantity: props.product?.quantity ?? 0,
  reservedQuantity: props.product?.reservedQuantity ?? 0,
  rentedQuantity: props.product?.rentedQuantity ?? 0,
  damagedQuantity: props.product?.damagedQuantity ?? 0,
  maintenanceQuantity: props.product?.maintenanceQuantity ?? 0,
  lostQuantity: props.product?.lostQuantity ?? 0,
  status: props.product?.status ?? 'draft',
  condition: props.product?.condition ?? 'good',
  accessories: props.product?.includedAccessories.join(', ') ?? '',
  specifications: props.product
    ? Object.entries(props.product.specifications).map(([key, value]) => `${key}: ${value}`).join('\n')
    : '',
  rentalRules: props.product?.rentalRules ?? '',
  modelPath: props.product?.modelPath ?? '',
  isFeatured: props.product?.isFeatured ?? false,
})

function parseSpecifications(value: string) {
  const entries = value.split('\n').map(line => line.trim()).filter(Boolean)
  return Object.fromEntries(entries.map((line) => {
    const [key, ...rest] = line.split(':')
    return [key.trim(), rest.join(':').trim()]
  }).filter(([key, value]) => key && value))
}

async function onSubmit() {
  formError.value = ''
  errors.value = {}

  const { accessories, specifications, hideOnStorefront, ...fields } = form
  const parsed = productInputSchema.safeParse({
    ...fields,
    weeklyPrice: form.weeklyPrice === '' ? null : form.weeklyPrice,
    monthlyPrice: form.monthlyPrice === '' ? null : form.monthlyPrice,
    replacementValue: form.replacementValue === '' ? null : form.replacementValue,
    hiddenPriceFields: PRICE_FIELD_KEYS.filter(key => hideOnStorefront[key]),
    includedAccessories: accessories.split(',').map(item => item.trim()).filter(Boolean),
    specifications: parseSpecifications(specifications),
    rentalRules: form.rentalRules,
    modelPath: form.modelPath,
  })

  if (!parsed.success) {
    errors.value = fieldErrors(parsed.error)
    formError.value = parsed.error.issues[0]?.message || 'Please check the submitted information.'
    return
  }

  pending.value = true

  try {
    const result = props.product
      ? await $fetch<PublicProduct>(`/api/admin/products/${props.product.uuid}`, {
        method: 'PATCH',
        headers: authHeaders(),
        body: parsed.data,
      })
      : await $fetch<PublicProduct>('/api/admin/products', {
        method: 'POST',
        headers: authHeaders(),
        body: parsed.data,
      })

    toast.add({ title: 'Product saved', color: 'success' })
    emit('saved', result.uuid)
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not save that product.'
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <form
    class="space-y-8"
    method="post"
    @submit.prevent="onSubmit"
  >
    <AuthAlert
      v-if="formError"
      :description="formError"
    />

    <section class="rounded-xl border border-stone-200 bg-white p-5">
      <h3 class="text-sm font-medium text-stone-900">
        Details
      </h3>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">Name</span>
          <UInput
            v-model="form.name"
            :disabled="pending"
          />
          <span
            v-if="errors.name"
            class="mt-1 block text-xs text-red-700"
          >{{ errors.name }}</span>
          <span class="mt-1 block text-xs text-stone-500">
            Public URL uses this name: /products/{{ slugify(form.name) || 'item' }}
          </span>
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">SKU</span>
          <UInput
            v-model="form.sku"
            :disabled="pending"
          />
          <span
            v-if="errors.sku"
            class="mt-1 block text-xs text-red-700"
          >{{ errors.sku }}</span>
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">Category</span>
          <select
            v-model="form.categoryUuid"
            class="w-full rounded-md border border-stone-200 bg-white px-3 py-2"
            :disabled="pending"
          >
            <option
              disabled
              value=""
            >
              Select category
            </option>
            <option
              v-for="category in categories"
              :key="category.uuid"
              :value="category.uuid"
            >
              {{ category.name }}
            </option>
          </select>
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">Status</span>
          <select
            v-model="form.status"
            class="w-full rounded-md border border-stone-200 bg-white px-3 py-2"
            :disabled="pending"
          >
            <option
              v-for="item in PRODUCT_STATUSES"
              :key="item"
              :value="item"
            >
              {{ item === 'coming_soon' ? 'Coming soon' : item.replaceAll('_', ' ') }}
            </option>
          </select>
        </label>
        <label class="block text-sm sm:col-span-2">
          <span class="mb-1.5 block text-stone-700">Short description</span>
          <UInput
            v-model="form.shortDescription"
            :disabled="pending"
          />
          <span class="mt-1 block text-xs text-stone-500">
            Used on catalog cards, not the product page kit section.
          </span>
        </label>
        <label class="flex items-center gap-2 text-sm text-stone-700">
          <input
            v-model="form.isFeatured"
            type="checkbox"
            :disabled="pending"
          >
          Featured product
        </label>
      </div>
    </section>

    <section class="rounded-xl border border-stone-200 bg-white p-5">
      <h3 class="text-sm font-medium text-stone-900">
        Pricing
      </h3>
      <p class="mt-1 text-sm text-stone-500">
        Amounts stay in PHP and still apply to quotes. Hide a field to keep it off the public catalog.
      </p>
      <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label
          v-for="field in [
            ['dailyPrice', 'daily', 'Daily (₱)'],
            ['weeklyPrice', 'weekly', 'Weekly (₱)'],
            ['monthlyPrice', 'monthly', 'Monthly (₱)'],
            ['depositAmount', 'deposit', 'Deposit (₱)'],
            ['lateFee', 'lateFee', 'Late fee (₱)'],
            ['replacementValue', 'replacementValue', 'Replacement value (₱)'],
          ] as const"
          :key="field[0]"
          class="block text-sm"
        >
          <span class="mb-1.5 flex items-center justify-between gap-3 text-stone-700">
            {{ field[2] }}
            <span class="inline-flex items-center gap-1.5 text-xs font-normal text-stone-500">
              <input
                v-model="form.hideOnStorefront[field[1]]"
                type="checkbox"
                :disabled="pending"
              >
              Hide
            </span>
          </span>
          <UInput
            v-model="form[field[0]]"
            type="number"
            min="0"
            step="0.01"
            :disabled="pending"
          />
          <span
            v-if="errors[field[0]]"
            class="mt-1 block text-xs text-red-700"
          >{{ errors[field[0]] }}</span>
        </label>
      </div>
    </section>

    <section class="rounded-xl border border-stone-200 bg-white p-5">
      <h3 class="text-sm font-medium text-stone-900">
        Inventory
      </h3>
      <div class="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <label
          v-for="field in [
            ['quantity', 'Total'],
            ['reservedQuantity', 'Reserved'],
            ['rentedQuantity', 'Rented'],
            ['damagedQuantity', 'Damaged'],
            ['maintenanceQuantity', 'Maintenance'],
            ['lostQuantity', 'Lost'],
          ] as const"
          :key="field[0]"
          class="block text-sm"
        >
          <span class="mb-1.5 block text-stone-700">{{ field[1] }}</span>
          <UInput
            v-model="form[field[0]]"
            type="number"
            min="0"
            :disabled="pending"
          />
        </label>
      </div>
    </section>

    <section class="rounded-xl border border-stone-200 bg-white p-5">
      <h3 class="text-sm font-medium text-stone-900">
        Product page copy
      </h3>
      <p class="mt-1 text-sm text-stone-500">
        These fields are what customers see under About this kit, Specifications, Included accessories, and Rental rules.
      </p>
      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">About this kit</span>
          <UTextarea
            v-model="form.description"
            :rows="5"
            :disabled="pending"
          />
          <span
            v-if="errors.description"
            class="mt-1 block text-xs text-red-700"
          >{{ errors.description }}</span>
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">Specifications</span>
          <UTextarea
            v-model="form.specifications"
            :rows="4"
            placeholder="video: 4K60"
            :disabled="pending"
          />
          <span class="mt-1 block text-xs text-stone-500">
            One specification per line as name: value.
          </span>
          <span
            v-if="errors.specifications"
            class="mt-1 block text-xs text-red-700"
          >{{ errors.specifications }}</span>
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">Included accessories</span>
          <UInput
            v-model="form.accessories"
            placeholder="Battery x2, Charger, Strap"
            :disabled="pending"
          />
          <span class="mt-1 block text-xs text-stone-500">
            Separate items with commas.
          </span>
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">Rental rules</span>
          <UTextarea
            v-model="form.rentalRules"
            :rows="3"
            :disabled="pending"
          />
          <span
            v-if="errors.rentalRules"
            class="mt-1 block text-xs text-red-700"
          >{{ errors.rentalRules }}</span>
        </label>
      </div>
    </section>

    <section class="rounded-xl border border-stone-200 bg-white p-5">
      <h3 class="text-sm font-medium text-stone-900">
        Condition and model
      </h3>
      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">Condition</span>
          <UInput
            v-model="form.condition"
            :disabled="pending"
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">3D model path</span>
          <UInput
            v-model="form.modelPath"
            placeholder="/models/starlink.glb"
            :disabled="pending"
          />
        </label>
      </div>
    </section>

    <UButton
      type="submit"
      class="w-full sm:w-auto"
      :loading="pending"
    >
      Save product
    </UButton>
  </form>
</template>
