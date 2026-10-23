<script setup lang="ts">
import type { PublicRental, PublicRentalExtension, RentalExtensionPreview } from '~/types/rental'
import { formatBusinessDateTime } from '~/utils/datetime'
import { addCalendarDays } from '~/utils/expense'
import { SHOP_PAYMENT_METHODS } from '~/utils/rental'
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

const payMethod = ref<(typeof SHOP_PAYMENT_METHODS)[number]>('cash')
const payingUuid = ref<string | null>(null)

async function markExtensionPaid(uuid: string) {
  payingUuid.value = uuid
  try {
    await $fetch(`/api/admin/rentals/${props.rental.uuid}/extensions/${uuid}/paid`, {
      method: 'POST',
      body: { paymentMethod: payMethod.value },
    })
    toast.add({ title: 'Extension marked paid', color: 'success' })
    await refreshExtensions()
    emit('extended')
  }
  catch (error) {
    toast.add({ title: errorMessage(error, 'We could not record that payment.'), color: 'error' })
  }
  finally {
    payingUuid.value = null
  }
}

const editUuid = ref<string | null>(null)
const editEndsOn = ref('')
const editNote = ref('')
const editPreview = ref<RentalExtensionPreview | null>(null)
const editError = ref('')
const editPreviewing = ref(false)
const editSaving = ref(false)
const editing = computed(() => extensions.value?.find(extension => extension.uuid === editUuid.value) ?? null)

function startEdit(extension: PublicRentalExtension) {
  cancelUuid.value = null
  editUuid.value = extension.uuid
  editEndsOn.value = extension.endsOn
  editNote.value = extension.note || ''
  editPreview.value = null
  editError.value = ''
}

function stopEdit() {
  editUuid.value = null
  editPreview.value = null
  editError.value = ''
}

async function loadEditPreview() {
  editPreview.value = null
  editError.value = ''
  const current = editing.value
  if (!current?.canEditDates || !editEndsOn.value) {
    return
  }

  editPreviewing.value = true
  try {
    editPreview.value = await $fetch<RentalExtensionPreview>(`/api/admin/rentals/${props.rental.uuid}/extensions/${current.uuid}`, {
      method: 'PATCH',
      body: { endsOn: editEndsOn.value, preview: true },
    })
  }
  catch (error) {
    editError.value = errorMessage(error, 'We could not price that change.')
  }
  finally {
    editPreviewing.value = false
  }
}

watchDebounced(
  () => [editUuid.value, editEndsOn.value],
  () => {
    void loadEditPreview()
  },
  { debounce: 300 },
)

async function saveEdit() {
  const current = editing.value
  if (!current) {
    return
  }

  editSaving.value = true
  editError.value = ''
  try {
    await $fetch(`/api/admin/rentals/${props.rental.uuid}/extensions/${current.uuid}`, {
      method: 'PATCH',
      body: {
        note: editNote.value,
        ...(current.canEditDates && editEndsOn.value ? { endsOn: editEndsOn.value } : {}),
      },
    })
    toast.add({ title: 'Extension updated', color: 'success' })
    stopEdit()
    await refreshExtensions()
    emit('extended')
  }
  catch (error) {
    editError.value = errorMessage(error, 'We could not update that extension.')
  }
  finally {
    editSaving.value = false
  }
}

const cancelUuid = ref<string | null>(null)
const cancelReason = ref('')
const cancelling = ref(false)

function startCancel(uuid: string) {
  stopEdit()
  cancelUuid.value = uuid
}

async function cancelExtension(uuid: string) {
  cancelling.value = true
  try {
    await $fetch(`/api/admin/rentals/${props.rental.uuid}/extensions/${uuid}/cancel`, {
      method: 'POST',
      body: { reason: cancelReason.value },
    })
    toast.add({ title: 'Extension cancelled', color: 'success' })
    cancelUuid.value = null
    cancelReason.value = ''
    await refreshExtensions()
    emit('extended')
  }
  catch (error) {
    toast.add({ title: errorMessage(error, 'We could not cancel that extension.'), color: 'error' })
  }
  finally {
    cancelling.value = false
  }
}

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
      Choose the new return date. Only the added days are charged. The long-stay less applies when the extension itself is long enough. On a paid booking, the extension stays unpaid and out of sales until you mark it paid.
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
            Extension · {{ preview.extensionDays }} day{{ preview.extensionDays === 1 ? '' : 's' }}
          </dt>
          <dd>{{ formatMoney(preview.extensionRentAmount) }}</dd>
        </div>
        <div
          v-if="preview.extensionLessAmount > 0"
          class="flex justify-between gap-4"
        >
          <dt class="text-stone-500">
            Long-stay less
          </dt>
          <dd>−{{ formatMoney(preview.extensionLessAmount) }}</dd>
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
          :class="extension.cancelledAt ? 'opacity-70' : ''"
        >
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <span
              class="text-stone-900"
              :class="extension.cancelledAt ? 'line-through' : ''"
            >
              {{ formatBusinessDateTime(extension.previousReturnAt || extension.previousEndsOn) }}
              → {{ formatBusinessDateTime(extension.returnAt) }}
            </span>
            <span class="flex items-center gap-2">
              <UBadge
                v-if="extension.cancelledAt"
                color="neutral"
                variant="soft"
                size="sm"
              >
                Cancelled
              </UBadge>
              <UBadge
                v-else-if="extension.paymentStatus === 'unpaid'"
                color="warning"
                variant="soft"
                size="sm"
              >
                Unpaid
              </UBadge>
              <UBadge
                v-else-if="extension.paymentStatus === 'paid'"
                color="success"
                variant="soft"
                size="sm"
              >
                Paid
              </UBadge>
              <span
                class="font-medium text-stone-900"
                :class="extension.cancelledAt ? 'line-through' : ''"
              >+{{ formatMoney(extension.addedAmount) }}</span>
            </span>
          </div>
          <p
            v-if="extension.cancelledAt"
            class="text-xs text-stone-500"
          >
            Cancelled {{ formatBusinessDateTime(extension.cancelledAt) }}<template v-if="extension.cancelReason">
              · {{ extension.cancelReason }}
            </template>
          </p>
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
          <p
            v-if="extension.editedAt && !extension.cancelledAt"
            class="text-xs text-stone-500"
          >
            Edited {{ formatBusinessDateTime(extension.editedAt) }}
          </p>
          <p
            v-if="extension.paymentStatus === 'unpaid' && !extension.cancelledAt"
            class="text-xs text-amber-800"
          >
            Not paid yet. It is not counted in sales until you mark it paid.
          </p>
          <p
            v-else-if="extension.paymentStatus === 'paid' && extension.paidAt"
            class="text-xs text-stone-500"
          >
            Paid {{ formatBusinessDateTime(extension.paidAt) }}
          </p>
          <div
            v-if="extension.canMarkPaid && editUuid !== extension.uuid && cancelUuid !== extension.uuid"
            class="flex flex-wrap items-center gap-2 pt-2"
          >
            <select
              v-model="payMethod"
              class="h-8 rounded-md border border-stone-200 bg-white px-2 text-xs text-stone-800"
              :disabled="payingUuid === extension.uuid"
              aria-label="Payment method"
            >
              <option
                v-for="method in SHOP_PAYMENT_METHODS"
                :key="method"
                :value="method"
              >
                {{ method === 'gcash' ? 'GCash' : method === 'maya' ? 'Maya' : method === 'bank' ? 'Bank' : 'Cash' }}
              </option>
            </select>
            <UButton
              size="xs"
              class="flex-1 justify-center sm:flex-none"
              :loading="payingUuid === extension.uuid"
              @click="markExtensionPaid(extension.uuid)"
            >
              Mark extension paid · {{ formatMoney(extension.addedAmount) }}
            </UButton>
          </div>

          <div
            v-if="editUuid === extension.uuid"
            class="mt-2 space-y-3 rounded-lg bg-stone-50 p-3"
          >
            <template v-if="extension.canEditDates">
              <BookingDateField
                v-model="editEndsOn"
                label="Return date"
                :product-slug="productSlug || undefined"
                :quantity="rental.items[0]?.quantity || 1"
                :min="addCalendarDays(extension.previousEndsOn, 1)"
                :disabled="editSaving"
                flexible
              />
              <dl
                v-if="editPreview"
                class="space-y-1 text-xs"
              >
                <div class="flex justify-between gap-4">
                  <dt class="text-stone-500">
                    Extension · {{ editPreview.extensionDays }} day{{ editPreview.extensionDays === 1 ? '' : 's' }}
                  </dt>
                  <dd>{{ formatMoney(editPreview.extensionRentAmount) }}</dd>
                </div>
                <div
                  v-if="editPreview.extensionLessAmount > 0"
                  class="flex justify-between gap-4"
                >
                  <dt class="text-stone-500">
                    Long-stay less
                  </dt>
                  <dd>−{{ formatMoney(editPreview.extensionLessAmount) }}</dd>
                </div>
                <div class="flex justify-between gap-4">
                  <dt class="text-stone-500">
                    Added
                  </dt>
                  <dd>{{ formatMoney(editPreview.addedAmount) }}</dd>
                </div>
                <div class="flex justify-between gap-4 font-medium text-stone-900">
                  <dt>New rent</dt>
                  <dd>{{ formatMoney(editPreview.totalAmount) }}</dd>
                </div>
                <p
                  v-if="editPreview.addedAmount !== extension.addedAmount"
                  class="text-stone-600"
                >
                  Saving re-prices this extension from {{ formatMoney(extension.addedAmount) }} to {{ formatMoney(editPreview.addedAmount) }}.
                </p>
                <p
                  v-if="!editPreview.canFulfill"
                  class="text-red-800"
                >
                  Another booking already holds this kit on the new dates.
                </p>
              </dl>
            </template>
            <p
              v-else
              class="text-xs text-stone-500"
            >
              Only the note can be changed on this entry. The return date can be changed on the most recent extension.
            </p>
            <UTextarea
              v-model="editNote"
              :rows="2"
              placeholder="Note"
              class="w-full"
              :disabled="editSaving"
            />
            <p
              v-if="editError"
              class="text-xs text-red-800"
            >
              {{ editError }}
            </p>
            <div class="flex flex-wrap gap-2">
              <UButton
                size="xs"
                class="flex-1 justify-center sm:flex-none"
                :loading="editSaving || editPreviewing"
                :disabled="Boolean(editPreview && !editPreview.canFulfill)"
                @click="saveEdit"
              >
                Save changes
              </UButton>
              <UButton
                size="xs"
                color="neutral"
                variant="ghost"
                class="flex-1 justify-center sm:flex-none"
                :disabled="editSaving"
                @click="stopEdit"
              >
                Close
              </UButton>
            </div>
          </div>

          <div
            v-else-if="extension.canEdit || extension.canCancel"
            class="flex flex-wrap gap-2 pt-2"
          >
            <UButton
              v-if="extension.canEdit && cancelUuid !== extension.uuid"
              size="xs"
              color="neutral"
              variant="outline"
              class="flex-1 justify-center sm:flex-none"
              @click="startEdit(extension)"
            >
              Edit
            </UButton>
            <UButton
              v-if="extension.canCancel && cancelUuid !== extension.uuid"
              size="xs"
              color="neutral"
              variant="outline"
              class="flex-1 justify-center sm:flex-none"
              @click="startCancel(extension.uuid)"
            >
              Cancel extension
            </UButton>
            <div
              v-if="extension.canCancel && cancelUuid === extension.uuid"
              class="w-full space-y-2 rounded-lg bg-stone-50 p-3"
            >
              <p class="text-xs text-stone-600">
                Moves the return back to {{ formatBusinessDateTime(extension.previousReturnAt || extension.previousEndsOn) }} and removes {{ formatMoney(extension.addedAmount) }} from the rent.
              </p>
              <UTextarea
                v-model="cancelReason"
                :rows="2"
                placeholder="Reason (optional)"
                class="w-full"
                :disabled="cancelling"
              />
              <div class="flex flex-wrap gap-2">
                <UButton
                  size="xs"
                  color="warning"
                  class="flex-1 justify-center sm:flex-none"
                  :loading="cancelling"
                  @click="cancelExtension(extension.uuid)"
                >
                  Confirm cancel
                </UButton>
                <UButton
                  size="xs"
                  color="neutral"
                  variant="ghost"
                  class="flex-1 justify-center sm:flex-none"
                  :disabled="cancelling"
                  @click="cancelUuid = null"
                >
                  Keep extension
                </UButton>
              </div>
            </div>
          </div>
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
