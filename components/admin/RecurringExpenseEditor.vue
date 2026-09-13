<script setup lang="ts">
import { EXPENSE_CATEGORIES, EXPENSE_FREQUENCIES } from '~/utils/constants'

const props = defineProps<{
  initial?: {
    name?: string
    category?: string
    amount?: number
    frequency?: string
    intervalCount?: number
    anchorDay?: number | null
    startOn?: string
    endOn?: string | null
    nextOccurrenceOn?: string
    vendor?: string | null
    notes?: string | null
  }
  disabled?: boolean
  loading?: boolean
  error?: string
  submitLabel?: string
}>()

const emit = defineEmits<{
  submit: [payload: Record<string, unknown>]
}>()

const form = reactive({
  name: props.initial?.name ?? '',
  category: props.initial?.category ?? 'subscription',
  amount: props.initial?.amount ?? 0,
  frequency: props.initial?.frequency ?? 'monthly',
  intervalCount: props.initial?.intervalCount ?? 1,
  anchorDay: props.initial?.anchorDay ?? '',
  startOn: props.initial?.startOn ?? '',
  endOn: props.initial?.endOn ?? '',
  nextOccurrenceOn: props.initial?.nextOccurrenceOn ?? '',
  vendor: props.initial?.vendor ?? '',
  notes: props.initial?.notes ?? '',
})

function onSubmit() {
  emit('submit', {
    name: form.name,
    category: form.category,
    amount: Number(form.amount),
    frequency: form.frequency,
    intervalCount: Number(form.intervalCount),
    anchorDay: form.anchorDay === '' ? null : Number(form.anchorDay),
    startOn: form.startOn,
    endOn: form.endOn || undefined,
    nextOccurrenceOn: form.nextOccurrenceOn || undefined,
    vendor: form.vendor,
    notes: form.notes,
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
        <span class="text-stone-600">Vendor</span>
        <input
          v-model="form.vendor"
          class="mt-1 w-full rounded-md border border-stone-200 px-3 py-2"
          :disabled="disabled"
        >
      </label>
      <label class="block text-sm">
        <span class="text-stone-600">Frequency</span>
        <select
          v-model="form.frequency"
          class="mt-1 w-full rounded-md border border-stone-200 px-3 py-2"
          :disabled="disabled"
        >
          <option
            v-for="frequency in EXPENSE_FREQUENCIES"
            :key="frequency"
            :value="frequency"
          >
            {{ frequency }}
          </option>
        </select>
      </label>
      <label class="block text-sm">
        <span class="text-stone-600">Interval</span>
        <input
          v-model.number="form.intervalCount"
          class="mt-1 w-full rounded-md border border-stone-200 px-3 py-2"
          type="number"
          min="1"
          :disabled="disabled"
        >
      </label>
      <label class="block text-sm">
        <span class="text-stone-600">Anchor day</span>
        <input
          v-model="form.anchorDay"
          class="mt-1 w-full rounded-md border border-stone-200 px-3 py-2"
          type="number"
          min="1"
          max="31"
          :disabled="disabled"
          placeholder="e.g. 15"
        >
      </label>
      <label class="block text-sm">
        <span class="text-stone-600">Start on</span>
        <input
          v-model="form.startOn"
          class="mt-1 w-full rounded-md border border-stone-200 px-3 py-2"
          type="date"
          :disabled="disabled"
          required
        >
      </label>
      <label class="block text-sm">
        <span class="text-stone-600">End on</span>
        <input
          v-model="form.endOn"
          class="mt-1 w-full rounded-md border border-stone-200 px-3 py-2"
          type="date"
          :disabled="disabled"
        >
      </label>
      <label class="block text-sm">
        <span class="text-stone-600">Next occurrence</span>
        <input
          v-model="form.nextOccurrenceOn"
          class="mt-1 w-full rounded-md border border-stone-200 px-3 py-2"
          type="date"
          :disabled="disabled"
        >
      </label>
    </div>

    <label class="block text-sm">
      <span class="text-stone-600">Notes</span>
      <textarea
        v-model="form.notes"
        class="mt-1 w-full rounded-md border border-stone-200 px-3 py-2"
        rows="2"
        :disabled="disabled"
      />
    </label>

    <p class="text-xs text-stone-500">
      Custom frequency uses the interval as days. A midnight Asia/Manila job posts due dates; you can also post the next due date here.
    </p>

    <UButton
      type="submit"
      :loading="loading"
      :disabled="disabled"
    >
      {{ submitLabel || 'Save recurring expense' }}
    </UButton>
  </form>
</template>
