<script setup lang="ts">
import { blockedDateInputSchema } from '~/utils/product-validation'
import { calendarDateInZone } from '~/utils/datetime'

const today = calendarDateInZone()

const props = defineProps<{
  products: Array<{ uuid: string, name: string }>
  startsOn: string
  endsOn: string
}>()

const emit = defineEmits<{
  'saved': []
  'update:startsOn': [value: string]
  'update:endsOn': [value: string]
}>()

const toast = useToast()
const form = reactive({
  productUuid: '',
  reason: '',
})
const startsOn = computed({
  get: () => props.startsOn,
  set: value => emit('update:startsOn', value),
})
const endsOn = computed({
  get: () => props.endsOn,
  set: value => emit('update:endsOn', value),
})
const formError = ref('')
const saving = ref(false)

function resetForm() {
  startsOn.value = ''
  endsOn.value = ''
  form.reason = ''
  formError.value = ''
}

function apiErrorMessage(caught: unknown, fallback: string) {
  const payload = typeof caught === 'object' && caught && 'data' in caught
    ? (caught as { data?: { message?: string } }).data
    : null
  return payload?.message || fallback
}

async function onSubmit() {
  formError.value = ''
  if (!form.productUuid) {
    formError.value = 'Choose a kit to block.'
    return
  }

  const parsed = blockedDateInputSchema.safeParse({
    startsOn: startsOn.value,
    endsOn: endsOn.value,
    reason: form.reason,
  })
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message || 'Check the blocked dates.'
    return
  }

  saving.value = true
  try {
    await $fetch(`/api/admin/products/${form.productUuid}/blocked-dates`, {
      method: 'POST',
      body: parsed.data,
    })
    toast.add({ title: 'Dates blocked', color: 'success' })
    resetForm()
    emit('saved')
  }
  catch (caught) {
    formError.value = apiErrorMessage(caught, 'We could not block those dates.')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="rounded-xl border border-stone-200 bg-white p-5">
    <h3 class="text-sm font-medium text-stone-900">
      Block dates
    </h3>
    <p class="mt-1 text-sm text-stone-500">
      Choose dates here, or open a day and use it to block. Blocked kits show as gray bars on the calendar; open that day to remove one. Only active kits can be blocked. Past dates and coming soon kits cannot be blocked or booked.
    </p>

    <AuthAlert
      v-if="formError"
      class="mt-4"
      :description="formError"
    />

    <form
      class="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-[1.2fr_1fr_1fr_1fr_auto] lg:items-end"
      method="post"
      @submit.prevent="onSubmit"
    >
      <label class="block text-sm">
        <span class="mb-1.5 block text-stone-700">Kit</span>
        <select
          v-model="form.productUuid"
          class="w-full rounded-md border border-stone-200 bg-white px-3 py-2"
          :disabled="saving"
        >
          <option value="">
            Choose a kit
          </option>
          <option
            v-for="product in products"
            :key="product.uuid"
            :value="product.uuid"
          >
            {{ product.name }}
          </option>
        </select>
      </label>
      <label class="block text-sm">
        <span class="mb-1.5 block text-stone-700">Starts on</span>
        <UInput
          v-model="startsOn"
          type="date"
          :min="today"
          :disabled="saving"
        />
      </label>
      <label class="block text-sm">
        <span class="mb-1.5 block text-stone-700">Ends on</span>
        <UInput
          v-model="endsOn"
          type="date"
          :min="startsOn || today"
          :disabled="saving"
        />
      </label>
      <label class="block text-sm">
        <span class="mb-1.5 block text-stone-700">Reason (optional)</span>
        <UInput
          v-model="form.reason"
          maxlength="200"
          placeholder="Holiday, maintenance"
          :disabled="saving"
        />
      </label>
      <UButton
        type="submit"
        :loading="saving"
      >
        Block dates
      </UButton>
    </form>
  </section>
</template>
