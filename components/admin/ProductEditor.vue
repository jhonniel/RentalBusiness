<script setup lang="ts">
import type { PublicCategory, PublicProduct } from '~/types/catalog'
import { PRODUCT_STATUSES } from '~/utils/constants'
import { fieldErrors } from '~/utils/auth-validation'
import { productInputSchema } from '~/utils/product-validation'

const props = defineProps<{
  product?: PublicProduct
  categories: PublicCategory[]
}>()

const emit = defineEmits<{
  saved: [uuid: string]
}>()

const toast = useToast()
const pending = ref(false)
const formError = ref('')
const errors = ref<Record<string, string>>({})

const form = reactive({
  name: props.product?.name ?? '',
  slug: props.product?.slug ?? '',
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

  const { accessories, specifications, ...fields } = form
  const parsed = productInputSchema.safeParse({
    ...fields,
    weeklyPrice: form.weeklyPrice === '' ? null : form.weeklyPrice,
    monthlyPrice: form.monthlyPrice === '' ? null : form.monthlyPrice,
    replacementValue: form.replacementValue === '' ? null : form.replacementValue,
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
      ? await $fetch<PublicProduct>(`/api/admin/products/${props.product.uuid}`, { method: 'PATCH', body: parsed.data })
      : await $fetch<PublicProduct>('/api/admin/products', { method: 'POST', body: parsed.data })

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
          <span class="mb-1.5 block text-stone-700">Slug</span>
          <UInput
            v-model="form.slug"
            placeholder="Generated from the name if empty"
            :disabled="pending"
          />
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
              {{ item }}
            </option>
          </select>
        </label>
        <label class="block text-sm sm:col-span-2">
          <span class="mb-1.5 block text-stone-700">Short description</span>
          <UInput
            v-model="form.shortDescription"
            :disabled="pending"
          />
        </label>
        <label class="block text-sm sm:col-span-2">
          <span class="mb-1.5 block text-stone-700">Description</span>
          <UTextarea
            v-model="form.description"
            :rows="5"
            :disabled="pending"
          />
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
      <div class="mt-4 grid gap-4 sm:grid-cols-3">
        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">Daily (₱)</span>
          <UInput
            v-model="form.dailyPrice"
            type="number"
            min="0"
            step="0.01"
            :disabled="pending"
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">Weekly (₱)</span>
          <UInput
            v-model="form.weeklyPrice"
            type="number"
            min="0"
            step="0.01"
            :disabled="pending"
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">Monthly (₱)</span>
          <UInput
            v-model="form.monthlyPrice"
            type="number"
            min="0"
            step="0.01"
            :disabled="pending"
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">Deposit (₱)</span>
          <UInput
            v-model="form.depositAmount"
            type="number"
            min="0"
            step="0.01"
            :disabled="pending"
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">Late fee (₱)</span>
          <UInput
            v-model="form.lateFee"
            type="number"
            min="0"
            step="0.01"
            :disabled="pending"
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">Replacement value (₱)</span>
          <UInput
            v-model="form.replacementValue"
            type="number"
            min="0"
            step="0.01"
            :disabled="pending"
          />
        </label>
      </div>
    </section>

    <section class="rounded-xl border border-stone-200 bg-white p-5">
      <h3 class="text-sm font-medium text-stone-900">
        Inventory
      </h3>
      <div class="mt-4 grid gap-4 sm:grid-cols-3">
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
        Rules and specifications
      </h3>
      <div class="mt-4 grid gap-4">
        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">Included accessories</span>
          <UInput
            v-model="form.accessories"
            placeholder="Battery, charger, strap"
            :disabled="pending"
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">Specifications</span>
          <UTextarea
            v-model="form.specifications"
            :rows="4"
            placeholder="sensor: 33MP full-frame"
            :disabled="pending"
          />
        </label>
        <label class="block text-sm">
          <span class="mb-1.5 block text-stone-700">Rental rules</span>
          <UTextarea
            v-model="form.rentalRules"
            :rows="3"
            :disabled="pending"
          />
        </label>
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
      :loading="pending"
    >
      Save product
    </UButton>
  </form>
</template>
