<script setup lang="ts">
import type { PublicRental, PublicRentalExtension, RentalExtensionPreview } from '~/types/rental'
import { formatBusinessDateTime } from '~/utils/datetime'
import { addCalendarDays } from '~/utils/expense'
import { canModifyAdminRental } from '~/utils/waiver-invite'

const props = defineProps<{
  rental: PublicRental
}>()

const emit = defineEmits<{
  extended: []
}>()

const toast = useToast()
const { formatMoney } = useCurrency()
const endsOn = ref('')
const note = ref('')
const preview = ref<RentalExtensionPreview | null>(null)
const previewError = ref('')
const previewing = ref(false)
const saving = ref(false)
const formError = ref('')

const canExtend = computed(() => canModifyAdminRental(props.rental))
const earliestReturn = computed(() => addCalendarDays(props.rental.endsOn, 1))
const productSlug = computed(() => props.rental.items[0]?.product.slug || '')

const { data: extensions, error: extensionsError, refresh: refreshExtensions } = await useFetch<PublicRentalExtension[]>(
  () => `/api/admin/rentals/${props.rental.uuid}/extensions`,
)

function errorMessage(error: unknown, fallback: string) {
  const payload = typeof error === 'object' && error && 'data' in error
    ? (error as { data?: { message?: string } }).data
    : null
  return payload?.message || fallback
}

async function loadPreview() {
  preview.value = null
  previewError.value = ''
  if (!endsOn.value || !canExtend.value) {
    return
  }

  previewing.value = true
  try {
    preview.value = await $fetch<RentalExtensionPreview>(`/api/admin/rentals/${props.rental.uuid}/extend`, {
      method: 'POST',
      body: { endsOn: endsOn.value, preview: true },
    })
  }
  catch (error) {
    previewError.value = errorMessage(error, 'We could not price that extension.')
  }
  finally {
    previewing.value = false
  }
}

watchDebounced(
  () => [endsOn.value, props.rental.endsOn],
  () => {
    void loadPreview()
  },
  { debounce: 300 },
)

async function extend() {
  formError.value = ''
  if (!endsOn.value) {
    formError.value = 'Choose the new return date.'
    return
  }

  saving.value = true
  try {
    await $fetch(`/api/admin/rentals/${props.rental.uuid}/extend`, {
      method: 'POST',
      body: { endsOn: endsOn.value, note: note.value },
    })
    toast.add({ title: 'Booking extended', color: 'success' })
    endsOn.value = ''
    note.value = ''
    preview.value = null
    await refreshExtensions()
    emit('extended')
  }
  catch (error) {
    formError.value = errorMessage(error, 'We could not extend that booking.')
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <section class="rounded-xl border border-stone-200 bg-white p-5 text-sm">
    <h3 class="font-medium text-stone-900">
      Extend booking
    </h3>
    <p class="mt-1 text-stone-600">
      Choose the new return date. The new rent is priced on the server and every extension is logged below.
    </p>

    <div
      v-if="canExtend"
      class="mt-4 space-y-3"
    >
      <BookingDateField
        v-model="endsOn"
        label="New return date"
        :product-slug="productSlug || undefined"
        :quantity="rental.items[0]?.quantity || 1"
        :min="earliestReturn"
        :disabled="saving"
        flexible
      />
      <p class="text-xs text-stone-500">
        Current return {{ formatBusinessDateTime(rental.returnAt) }}
      </p>

      <dl
        v-if="preview"
        class="space-y-1.5 rounded-lg bg-stone-50 p-3"
      >
        <div class="flex justify-between gap-4">
          <dt class="text-stone-500">
            New return
          </dt>
          <dd>{{ formatBusinessDateTime(preview.returnAt) }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-stone-500">
            Rent before
          </dt>
          <dd>{{ formatMoney(preview.previousTotalAmount) }}</dd>
        </div>
        <div class="flex justify-between gap-4">
          <dt class="text-stone-500">
            Added
          </dt>
          <dd>{{ formatMoney(preview.addedAmount) }}</dd>
        </div>
        <div class="flex justify-between gap-4 font-medium text-stone-900">
          <dt>New rent · {{ preview.days }} day{{ preview.days === 1 ? '' : 's' }}</dt>
          <dd>{{ formatMoney(preview.totalAmount) }}</dd>
        </div>
        <p
          v-if="!preview.canFulfill"
          class="pt-1 text-red-800"
        >
          Another booking already holds this kit on the new dates.
        </p>
      </dl>
      <p
        v-else-if="previewError"
        class="text-red-800"
      >
        {{ previewError }}
      </p>

      <label class="block">
        <span class="mb-1.5 block text-stone-700">Note (optional)</span>
        <UTextarea
          v-model="note"
          :rows="2"
          :disabled="saving"
          placeholder="Example: customer paid the extra rent in cash"
          class="w-full"
        />
      </label>

      <p
        v-if="formError"
        class="text-red-800"
      >
        {{ formError }}
      </p>
      <UButton
        class="w-full justify-center sm:w-auto"
        :loading="saving || previewing"
        :disabled="!preview?.canFulfill"
        @click="extend"
      >
        Extend booking
      </UButton>
    </div>
    <p
      v-else
      class="mt-3 text-stone-500"
    >
      This booking can no longer be extended.
    </p>

    <div class="mt-6 border-t border-stone-100 pt-4">
      <h4 class="font-medium text-stone-900">
        Extension log
      </h4>
      <p
        v-if="extensionsError"
        class="mt-2 text-stone-500"
      >
        {{ errorMessage(extensionsError, 'The extension log could not be loaded.') }}
      </p>
      <ul
        v-else-if="extensions?.length"
        class="mt-3 divide-y divide-stone-100"
      >
        <li
          v-for="extension in extensions"
          :key="extension.uuid"
          class="space-y-1 py-3"
        >
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <span class="text-stone-900">
              {{ formatBusinessDateTime(extension.previousReturnAt || extension.previousEndsOn) }}
              → {{ formatBusinessDateTime(extension.returnAt) }}
            </span>
            <span class="font-medium text-stone-900">+{{ formatMoney(extension.addedAmount) }}</span>
          </div>
          <p class="text-xs text-stone-500">
            Rent {{ formatMoney(extension.previousTotalAmount) }} → {{ formatMoney(extension.totalAmount) }}
            · {{ formatBusinessDateTime(extension.createdAt) }}
            <template v-if="extension.extendedBy">
              · {{ extension.extendedBy }}
            </template>
          </p>
          <p
            v-if="extension.note"
            class="text-xs break-words text-stone-600"
          >
            {{ extension.note }}
          </p>
        </li>
      </ul>
      <p
        v-else
        class="mt-2 text-stone-500"
      >
        No extensions yet.
      </p>
    </div>
  </section>
</template>
