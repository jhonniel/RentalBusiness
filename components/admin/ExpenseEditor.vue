<script setup lang="ts">
import { EXPENSE_CATEGORIES } from '~/utils/constants'

const props = defineProps<{
  initial?: {
    name?: string
    category?: string
    description?: string | null
    amount?: number
    vendor?: string | null
    reference?: string | null
    status?: 'pending' | 'paid'
    notes?: string | null
    incurredOn?: string
  }
  disabled?: boolean
  loading?: boolean
  error?: string
  submitLabel?: string
}>()

const emit = defineEmits<{
  submit: [payload: {
    name: string
    category: string
    description: string
    amount: number
    vendor: string
    reference: string
    status: 'pending' | 'paid'
    notes: string
    incurredOn: string
  }]
}>()

const form = reactive({
  name: props.initial?.name ?? '',
  category: props.initial?.category ?? 'other',
  description: props.initial?.description ?? '',
  amount: props.initial?.amount ?? 0,
  vendor: props.initial?.vendor ?? '',
  reference: props.initial?.reference ?? '',
  status: props.initial?.status ?? 'pending',
  notes: props.initial?.notes ?? '',
  incurredOn: props.initial?.incurredOn ?? '',
})

function onSubmit() {
  emit('submit', {
    name: form.name,
    category: form.category,
    description: form.description,
    amount: Number(form.amount),
    vendor: form.vendor,
    reference: form.reference,
    status: form.status,
    notes: form.notes,
    incurredOn: form.incurredOn,
  })
}
</script>

<template>
  <form
    class="space-y-4 rounded-xl border border-stone-200 bg-white p-5"
    method="post"
    @submit.prevent="onSubmit"
  >
    <p
      v-if="error"
      class="text-sm text-red-700"
    >
      {{ error }}
    </p>

    <div class="grid gap-4 sm:grid-cols-2">
      <label class="block text-sm">
        <span class="text-stone-600">Name</span>
        <input
          v-model="form.name"
          class="mt-1 w-full rounded-md border border-stone-200 px-3 py-2"
          :disabled="disabled"
          required
        >
      </label>
      <label class="block text-sm">
        <span class="text-stone-600">Category</span>
        <select
          v-model="form.category"
          class="mt-1 w-full rounded-md border border-stone-200 px-3 py-2"
          :disabled="disabled"
        >
          <option
            v-for="category in EXPENSE_CATEGORIES"
            :key="category"
            :value="category"
          >
            {{ category }}
          </option>
        </select>
      </label>
      <label class="block text-sm">
        <span class="text-stone-600">Amount (PHP)</span>
        <input
          v-model.number="form.amount"
          class="mt-1 w-full rounded-md border border-stone-200 px-3 py-2"
          type="number"
          min="0"
          step="0.01"
          :disabled="disabled"
          required
        >
      </label>
      <label class="block text-sm">
        <span class="text-stone-600">Incurred on</span>
        <input
          v-model="form.incurredOn"
          class="mt-1 w-full rounded-md border border-stone-200 px-3 py-2"
          type="date"
          :disabled="disabled"
          required
        >
      </label>
      <label class="block text-sm">
        <span class="text-stone-600">Vendor</span>
        <input
          v-model="form.vendor"
          class="mt-1 w-full rounded-md border border-stone-200 px-3 py-2"
          :disabled="disabled"
        >
      </label>
      <label class="block text-sm">
        <span class="text-stone-600">Reference</span>
        <input
          v-model="form.reference"
          class="mt-1 w-full rounded-md border border-stone-200 px-3 py-2"
          :disabled="disabled"
        >
      </label>
      <label class="block text-sm">
        <span class="text-stone-600">Status</span>
        <select
          v-model="form.status"
          class="mt-1 w-full rounded-md border border-stone-200 px-3 py-2"
          :disabled="disabled"
        >
          <option value="pending">
            pending
          </option>
          <option value="paid">
            paid
          </option>
        </select>
      </label>
    </div>

    <label class="block text-sm">
      <span class="text-stone-600">Description</span>
      <textarea
        v-model="form.description"
        class="mt-1 w-full rounded-md border border-stone-200 px-3 py-2"
        rows="3"
        :disabled="disabled"
      />
    </label>

    <label class="block text-sm">
      <span class="text-stone-600">Notes</span>
      <textarea
        v-model="form.notes"
        class="mt-1 w-full rounded-md border border-stone-200 px-3 py-2"
        rows="2"
        :disabled="disabled"
      />
    </label>

    <UButton
      type="submit"
      :loading="loading"
      :disabled="disabled"
    >
      {{ submitLabel || 'Save expense' }}
    </UButton>
  </form>
</template>
