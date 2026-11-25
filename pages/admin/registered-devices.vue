<script setup lang="ts">
import type { ProductListResponse } from '~/types/catalog'
import type { AdminRegisteredDeviceListResponse, PublicRegisteredDevice } from '~/types/registered-device'
import { EQUIPMENT_STATUSES } from '~/utils/constants'
import { formatBookingDateRange } from '~/utils/datetime'
import { qrSvg } from '~/utils/qr'
import { registeredDeviceInputSchema } from '~/utils/registered-device-validation'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Registered Devices',
  path: '/admin/registered-devices',
})

const route = useRoute()
const toast = useToast()
const searchInput = ref('')
const search = refDebounced(searchInput, 300)
const status = ref('')
const productUuid = ref('')
const page = ref(1)
const focusDeviceUuid = computed(() => typeof route.query.device === 'string' ? route.query.device : '')
const focusRentalCode = computed(() => typeof route.query.rental === 'string' ? route.query.rental.trim() : '')

const query = computed(() => ({
  search: search.value || undefined,
  status: status.value || undefined,
  productUuid: productUuid.value || undefined,
  uuid: focusDeviceUuid.value || undefined,
  page: page.value,
  pageSize: 20,
}))

const { data, error, pending, refresh } = await useFetch<AdminRegisteredDeviceListResponse>('/api/admin/devices', {
  query,
  watch: [query],
})
const { data: products } = await useFetch<ProductListResponse>('/api/admin/products', {
  query: { pageSize: 50 },
})

const unavailable = computed(() => error.value?.statusCode === 503)
const ready = computed(() => data.value?.ready ?? false)
const items = computed(() => data.value?.items ?? [])
const totalPages = computed(() => Math.max(1, Math.ceil((data.value?.total ?? 0) / 20)))
const assignedCount = computed(() => items.value.filter(item => item.assignment).length)
const mostUsed = computed(() => items.value.reduce((max, item) => Math.max(max, item.usageCount), 0))

watch([search, status, productUuid], () => {
  page.value = 1
})

const editingUuid = ref<string | null>(null)
const selectedUuid = ref<string | null>(null)
const formError = ref('')
const saving = ref(false)
const assigning = ref(false)
const releasing = ref(false)
const rotating = ref(false)
const assignCode = ref(focusRentalCode.value || '')
const bagContentsText = ref('')

watch(focusRentalCode, (code) => {
  if (code) {
    assignCode.value = code
  }
}, { immediate: true })

const form = reactive({
  productUuid: '',
  label: '',
  assetCode: '',
  serialNumber: '',
  condition: 'good',
  status: 'available' as typeof EQUIPMENT_STATUSES[number],
  bagPin: '',
  wifiName: '',
  wifiPassword: '',
  notes: '',
})

const selected = computed(() => items.value.find(item => item.uuid === selectedUuid.value) || null)
const qrMarkup = computed(() => selected.value ? qrSvg(selected.value.pageUrl, { withLogo: true }) : '')

function resetForm() {
  editingUuid.value = null
  form.productUuid = products.value?.items[0]?.uuid || ''
  form.label = ''
  form.assetCode = ''
  form.serialNumber = ''
  form.condition = 'good'
  form.status = 'available'
  form.bagPin = ''
  form.wifiName = ''
  form.wifiPassword = ''
  form.notes = ''
  bagContentsText.value = ''
  formError.value = ''
}

function startCreate() {
  resetForm()
  editingUuid.value = 'new'
}

function startEdit(device: PublicRegisteredDevice) {
  editingUuid.value = device.uuid
  selectedUuid.value = device.uuid
  form.productUuid = device.product.uuid
  form.label = device.label || ''
  form.assetCode = device.assetCode
  form.serialNumber = device.serialNumber || ''
  form.condition = device.condition
  form.status = device.status
  form.bagPin = device.bagPin || ''
  form.wifiName = device.wifiName || ''
  form.wifiPassword = device.wifiPassword || ''
  form.notes = device.notes || ''
  bagContentsText.value = device.bagContents.join('\n')
  formError.value = ''
  // Keep rental code when deep-linked so another unit can be assigned after editing.
  if (!focusRentalCode.value) {
    assignCode.value = device.assignment?.rentalCode || assignCode.value
  }
}

function selectDevice(device: PublicRegisteredDevice) {
  selectedUuid.value = device.uuid
  if (editingUuid.value && editingUuid.value !== 'new' && editingUuid.value !== device.uuid) {
    editingUuid.value = null
  }
}

function parseBagLines(value: string) {
  return value
    .split(/\n|,/)
    .map(line => line.trim())
    .filter(Boolean)
}

async function saveDevice() {
  formError.value = ''
  const parsed = registeredDeviceInputSchema.safeParse({
    ...form,
    bagContents: parseBagLines(bagContentsText.value),
  })
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message || 'Check the device details.'
    return
  }

  saving.value = true
  try {
    const isNew = editingUuid.value === 'new'
    const saved = await $fetch<PublicRegisteredDevice>(
      isNew ? '/api/admin/devices' : `/api/admin/devices/${editingUuid.value}`,
      {
        method: isNew ? 'POST' : 'PATCH',
        body: parsed.data,
      },
    )
    toast.add({ title: isNew ? 'Device registered' : 'Device updated', color: 'success' })
    editingUuid.value = null
    selectedUuid.value = saved.uuid
    await refresh()
  }
  catch (err) {
    const payload = typeof err === 'object' && err && 'data' in err
      ? (err as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not save that device.'
  }
  finally {
    saving.value = false
  }
}

async function assignDevice() {
  if (!selected.value) {
    return
  }
  const rentalCode = assignCode.value.trim()
  assigning.value = true
  try {
    await $fetch(`/api/admin/devices/${selected.value.uuid}/assign`, {
      method: 'POST',
      body: { rentalCode },
    })
    toast.add({ title: 'Device assigned', color: 'success' })
    // Keep the rental code so the next free unit can be assigned to the same booking.
    assignCode.value = rentalCode
    await refresh()
  }
  catch (err) {
    const payload = typeof err === 'object' && err && 'data' in err
      ? (err as { data?: { message?: string } }).data
      : null
    toast.add({ title: payload?.message || 'Could not assign device', color: 'error' })
  }
  finally {
    assigning.value = false
  }
}

const releaseConfirmOpen = ref(false)
const rotateConfirmOpen = ref(false)

function askReleaseDevice() {
  if (!selected.value?.assignment) {
    return
  }
  releaseConfirmOpen.value = true
}

async function releaseDevice() {
  if (!selected.value) {
    return
  }
  releasing.value = true
  try {
    await $fetch(`/api/admin/devices/${selected.value.uuid}/release`, { method: 'POST' })
    toast.add({ title: 'Device released', color: 'success' })
    releaseConfirmOpen.value = false
    await refresh()
  }
  catch (err) {
    const payload = typeof err === 'object' && err && 'data' in err
      ? (err as { data?: { message?: string } }).data
      : null
    toast.add({ title: payload?.message || 'Could not release device', color: 'error' })
  }
  finally {
    releasing.value = false
  }
}

function askRotateCode() {
  if (!selected.value) {
    return
  }
  rotateConfirmOpen.value = true
}

async function rotateCode() {
  if (!selected.value) {
    return
  }
  rotating.value = true
  try {
    const saved = await $fetch<PublicRegisteredDevice>(`/api/admin/devices/${selected.value.uuid}/rotate`, {
      method: 'POST',
    })
    toast.add({ title: 'QR code rotated', color: 'success' })
    selectedUuid.value = saved.uuid
    rotateConfirmOpen.value = false
    await refresh()
  }
  catch (err) {
    const payload = typeof err === 'object' && err && 'data' in err
      ? (err as { data?: { message?: string } }).data
      : null
    toast.add({ title: payload?.message || 'Could not rotate code', color: 'error' })
  }
  finally {
    rotating.value = false
  }
}

async function copyPageUrl() {
  if (!selected.value?.pageUrl || !import.meta.client) {
    return
  }
  await navigator.clipboard.writeText(selected.value.pageUrl)
  toast.add({ title: 'Link copied', color: 'success' })
}

function printQr() {
  if (!import.meta.client) {
    return
  }
  window.print()
}

watch([items, focusDeviceUuid], ([list, focus]) => {
  const rows = list as PublicRegisteredDevice[]
  if (focus && rows.some(item => item.uuid === focus)) {
    selectedUuid.value = focus
    return
  }
  if (!selectedUuid.value && rows[0]) {
    selectedUuid.value = rows[0].uuid
  }
  else if (selectedUuid.value && !rows.some(item => item.uuid === selectedUuid.value)) {
    selectedUuid.value = rows[0]?.uuid || null
  }
}, { immediate: true })

</script>

<template>
  <div class="w-full space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <AdminPageHeader
        eyebrow="Operations"
        title="Registered Devices"
        description="Track serialized bags with permanent QR codes, bag pin, Wi‑Fi details, and rental assignment."
      />
      <UButton
        icon="i-lucide-plus"
        :disabled="!ready"
        @click="startCreate"
      >
        Register device
      </UButton>
    </div>

    <AdminNotice
      v-if="unavailable"
      title="Registered Devices is not connected"
      description="Add live Supabase credentials to manage devices."
    />

    <template v-else>
      <AdminBento>
        <AdminStat
          icon="i-lucide-qr-code"
          label="Devices"
          :value="String(data?.total ?? 0)"
        />
        <AdminStat
          icon="i-lucide-link"
          label="Assigned now"
          :value="String(assignedCount)"
          hint="On this page"
        />
        <AdminStat
          icon="i-lucide-repeat"
          label="Most used"
          :value="String(mostUsed)"
          hint="Lifetime assignments on this page"
        />
        <AdminStat
          icon="i-lucide-boxes"
          label="Inventory"
          value="Units"
          to="/admin/inventory"
          tone="accent"
        />
      </AdminBento>

      <AdminNotice
        v-if="data && !ready"
        title="Paste the registered devices SQL to start"
        description="Run supabase/migrations/20261125100000_registered_devices.sql in the Supabase SQL editor, then refresh this page."
      />

      <AdminNotice
        v-else-if="focusDeviceUuid || focusRentalCode"
        title="Opened from a rental link"
        :description="focusDeviceUuid
          ? 'Showing the linked registered device. Clear to browse all units.'
          : `Rental ${focusRentalCode} is ready to assign. Pick a free device and save.`"
      >
        <UButton
          to="/admin/registered-devices"
          color="neutral"
          variant="outline"
          size="sm"
        >
          Show all devices
        </UButton>
      </AdminNotice>

      <form
        class="grid gap-3 rounded-xl border border-stone-200 bg-white p-4 sm:grid-cols-3"
        method="get"
        @submit.prevent
      >
        <input
          v-model="searchInput"
          type="search"
          placeholder="Search label, code, serial, or QR"
          class="rounded-md border border-stone-200 px-3 py-2 text-sm"
        >
        <select
          v-model="status"
          class="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">
            All statuses
          </option>
          <option
            v-for="item in EQUIPMENT_STATUSES"
            :key="item"
            :value="item"
          >
            {{ item }}
          </option>
        </select>
        <select
          v-model="productUuid"
          class="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
        >
          <option value="">
            All products
          </option>
          <option
            v-for="product in products?.items"
            :key="product.uuid"
            :value="product.uuid"
          >
            {{ product.name }}
          </option>
        </select>
      </form>

      <div
        v-if="pending && !data"
        class="space-y-3"
      >
        <USkeleton class="h-24 w-full" />
        <USkeleton class="h-24 w-full" />
      </div>

      <div
        v-else
        class="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] xl:items-start"
      >
        <div class="space-y-4">
          <form
            v-if="editingUuid"
            class="rounded-xl border border-stone-200 bg-white p-5"
            method="post"
            @submit.prevent="saveDevice"
          >
            <h3 class="text-sm font-medium text-stone-900">
              {{ editingUuid === 'new' ? 'Register device' : 'Edit device' }}
            </h3>
            <AuthAlert
              v-if="formError"
              class="mt-3"
              :description="formError"
            />
            <div class="mt-4 grid gap-4 sm:grid-cols-2">
              <label class="block text-sm sm:col-span-2">
                <span class="mb-1.5 block text-stone-700">Product</span>
                <select
                  v-model="form.productUuid"
                  class="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                  :disabled="saving"
                  required
                >
                  <option
                    v-for="product in products?.items"
                    :key="product.uuid"
                    :value="product.uuid"
                  >
                    {{ product.name }}
                  </option>
                </select>
              </label>
              <label class="block text-sm">
                <span class="mb-1.5 block text-stone-700">Label</span>
                <UInput
                  v-model="form.label"
                  placeholder="Starlink Mini Bag A"
                  :disabled="saving"
                />
              </label>
              <label class="block text-sm">
                <span class="mb-1.5 block text-stone-700">Asset code</span>
                <UInput
                  v-model="form.assetCode"
                  :disabled="saving"
                />
              </label>
              <label class="block text-sm">
                <span class="mb-1.5 block text-stone-700">Serial number</span>
                <UInput
                  v-model="form.serialNumber"
                  :disabled="saving"
                />
              </label>
              <label class="block text-sm">
                <span class="mb-1.5 block text-stone-700">Condition</span>
                <UInput
                  v-model="form.condition"
                  :disabled="saving"
                />
              </label>
              <label class="block text-sm">
                <span class="mb-1.5 block text-stone-700">Status</span>
                <select
                  v-model="form.status"
                  class="w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm"
                  :disabled="saving"
                >
                  <option
                    v-for="item in EQUIPMENT_STATUSES"
                    :key="item"
                    :value="item"
                  >
                    {{ item }}
                  </option>
                </select>
              </label>
              <label class="block text-sm">
                <span class="mb-1.5 block text-stone-700">Bag pin</span>
                <UInput
                  v-model="form.bagPin"
                  :disabled="saving"
                />
              </label>
              <label class="block text-sm">
                <span class="mb-1.5 block text-stone-700">Wi‑Fi name</span>
                <UInput
                  v-model="form.wifiName"
                  :disabled="saving"
                />
              </label>
              <label class="block text-sm">
                <span class="mb-1.5 block text-stone-700">Wi‑Fi password</span>
                <UInput
                  v-model="form.wifiPassword"
                  :disabled="saving"
                />
              </label>
              <label class="block text-sm sm:col-span-2">
                <span class="mb-1.5 block text-stone-700">Bag contents (one per line)</span>
                <textarea
                  v-model="bagContentsText"
                  rows="4"
                  class="w-full rounded-md border border-stone-200 px-3 py-2 text-sm"
                  placeholder="Leave blank to use the product kit list"
                  :disabled="saving"
                />
              </label>
              <label class="block text-sm sm:col-span-2">
                <span class="mb-1.5 block text-stone-700">Notes</span>
                <UTextarea
                  v-model="form.notes"
                  :disabled="saving"
                />
              </label>
            </div>
            <div class="mt-4 flex flex-wrap gap-2">
              <UButton
                type="submit"
                :loading="saving"
              >
                Save
              </UButton>
              <UButton
                color="neutral"
                variant="ghost"
                :disabled="saving"
                @click="editingUuid = null"
              >
                Cancel
              </UButton>
            </div>
          </form>

          <AdminNotice
            v-if="ready && !items.length"
            title="No registered devices yet"
            description="Register a bag or unit to print its permanent QR and attach bag/Wi‑Fi details."
          >
            <UButton @click="startCreate">
              Register device
            </UButton>
          </AdminNotice>

          <div
            v-else-if="items.length"
            class="overflow-x-auto rounded-xl border border-stone-200 bg-white"
          >
            <table class="min-w-full text-left text-sm">
              <thead class="border-b border-stone-200 text-xs uppercase tracking-wider text-stone-500">
                <tr>
                  <th class="px-4 py-3 font-medium">
                    Device
                  </th>
                  <th class="px-4 py-3 font-medium">
                    Product
                  </th>
                  <th class="px-4 py-3 font-medium">
                    Status
                  </th>
                  <th class="px-4 py-3 font-medium">
                    Usage
                  </th>
                  <th class="px-4 py-3 font-medium">
                    Current
                  </th>
                  <th class="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="device in items"
                  :key="device.uuid"
                  class="cursor-pointer border-b border-stone-100 last:border-0"
                  :class="selectedUuid === device.uuid ? 'bg-stone-50' : ''"
                  @click="selectDevice(device)"
                >
                  <td class="px-4 py-3">
                    <p class="font-medium text-stone-900">
                      {{ device.label || device.assetCode }}
                    </p>
                    <p class="text-xs text-stone-500">
                      {{ device.assetCode }}
                      <span v-if="device.serialNumber"> · {{ device.serialNumber }}</span>
                    </p>
                  </td>
                  <td class="px-4 py-3 text-stone-600">
                    {{ device.product.name }}
                  </td>
                  <td class="px-4 py-3">
                    <StatusBadge :status="device.assignment ? 'rented' : device.status" />
                  </td>
                  <td class="px-4 py-3 tabular-nums text-stone-600">
                    {{ device.usageCount }}
                  </td>
                  <td class="px-4 py-3 text-stone-600">
                    <template v-if="device.assignment">
                      {{ device.assignment.customerName }}
                      <span class="block text-xs text-stone-500">{{ device.assignment.rentalCode }}</span>
                    </template>
                    <span v-else>Available</span>
                  </td>
                  <td class="px-4 py-3 text-right">
                    <UButton
                      color="neutral"
                      variant="ghost"
                      size="sm"
                      @click.stop="startEdit(device)"
                    >
                      Edit
                    </UButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div
            v-if="totalPages > 1"
            class="flex items-center justify-between gap-3"
          >
            <UButton
              color="neutral"
              variant="outline"
              :disabled="page <= 1"
              @click="page -= 1"
            >
              Previous
            </UButton>
            <p class="text-sm text-stone-500">
              Page {{ page }} of {{ totalPages }}
            </p>
            <UButton
              color="neutral"
              variant="outline"
              :disabled="page >= totalPages"
              @click="page += 1"
            >
              Next
            </UButton>
          </div>
        </div>

        <aside
          v-if="selected"
          class="device-qr-card space-y-4 rounded-xl border border-stone-200 bg-white p-5 print:border-0 print:p-0"
        >
          <div class="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 class="text-sm font-medium text-stone-900 print:text-center">
                {{ selected.label || selected.assetCode }}
              </h3>
              <p class="mt-1 text-xs text-stone-500 print:hidden">
                {{ selected.product.name }} · permanent QR for field use
              </p>
            </div>
            <UButton
              class="print:hidden"
              color="neutral"
              variant="outline"
              size="sm"
              icon="i-lucide-pencil"
              @click="startEdit(selected)"
            >
              Edit
            </UButton>
          </div>

          <div
            v-if="qrMarkup"
            class="mx-auto flex max-w-[14rem] justify-center rounded-xl border border-stone-100 bg-white p-3"
            v-html="qrMarkup"
          />
          <p class="break-all text-center font-mono text-[11px] text-stone-500">
            {{ selected.pageUrl }}
          </p>

          <div class="flex flex-wrap gap-2 print:hidden">
            <UButton
              color="neutral"
              variant="outline"
              icon="i-lucide-copy"
              @click="copyPageUrl"
            >
              Copy link
            </UButton>
            <UButton
              icon="i-lucide-printer"
              @click="printQr"
            >
              Print QR
            </UButton>
            <UButton
              color="neutral"
              variant="ghost"
              icon="i-lucide-refresh-cw"
              :loading="rotating"
              @click="askRotateCode"
            >
              New QR
            </UButton>
          </div>

          <div class="space-y-2 border-t border-stone-100 pt-4 text-sm print:hidden">
            <p v-if="selected.bagPin">
              <span class="text-stone-500">Bag pin</span>
              <span class="ml-2 font-medium text-stone-900">{{ selected.bagPin }}</span>
            </p>
            <p v-if="selected.wifiName">
              <span class="text-stone-500">Wi‑Fi</span>
              <span class="ml-2 font-medium text-stone-900">{{ selected.wifiName }}</span>
              <span
                v-if="selected.wifiPassword"
                class="ml-1 text-stone-600"
              >/ {{ selected.wifiPassword }}</span>
            </p>
            <p>
              <span class="text-stone-500">Usage</span>
              <span class="ml-2 font-medium text-stone-900">{{ selected.usageCount }}</span>
            </p>
          </div>

          <div class="border-t border-stone-100 pt-4 print:hidden">
            <h4 class="text-sm font-medium text-stone-900">
              Assignment
            </h4>
            <template v-if="selected.assignment">
              <p class="mt-2 text-sm text-stone-700">
                {{ selected.assignment.customerName }}
                ·
                <NuxtLink
                  :to="`/admin/rentals/${selected.assignment.rentalCode}`"
                  class="font-medium text-lumen-700 hover:underline"
                >
                  {{ selected.assignment.rentalCode }}
                </NuxtLink>
              </p>
              <p class="text-xs text-stone-500">
                {{ formatBookingDateRange(selected.assignment.startsOn, selected.assignment.endsOn) }}
              </p>
              <div class="mt-3 flex flex-wrap gap-2">
                <UButton
                  :to="`/admin/rentals/${selected.assignment.rentalCode}#assigned-devices`"
                  color="neutral"
                  variant="soft"
                  size="sm"
                  icon="i-lucide-clipboard-list"
                >
                  Open rental
                </UButton>
                <UButton
                  color="neutral"
                  variant="outline"
                  size="sm"
                  :loading="releasing"
                  @click="askReleaseDevice"
                >
                  Release
                </UButton>
              </div>
            </template>
            <form
              v-else
              class="mt-3 space-y-2"
              @submit.prevent="assignDevice"
            >
              <UInput
                v-model="assignCode"
                placeholder="Rental code"
                :disabled="assigning"
              />
              <p
                v-if="focusRentalCode"
                class="text-xs text-stone-500"
              >
                Prefilling from
                <NuxtLink
                  :to="`/admin/rentals/${focusRentalCode}#assigned-devices`"
                  class="text-lumen-700 hover:underline"
                >
                  {{ focusRentalCode }}
                </NuxtLink>
              </p>
              <UButton
                type="submit"
                :loading="assigning"
                :disabled="!assignCode.trim()"
              >
                Assign to rental
              </UButton>
            </form>
          </div>
        </aside>
      </div>
    </template>

    <AdminConfirmModal
      v-model:open="releaseConfirmOpen"
      title="Release this device?"
      description="The device will be unassigned from the current booking. Usage history stays on file."
      confirm-label="Release"
      :loading="releasing"
      @confirm="releaseDevice"
    />
    <AdminConfirmModal
      v-model:open="rotateConfirmOpen"
      title="Create a new QR code?"
      description="The old printed QR will stop working. Only continue if you will reprint the label."
      confirm-label="Rotate QR"
      confirm-color="warning"
      :loading="rotating"
      @confirm="rotateCode"
    />
  </div>
</template>

<style scoped>
@media print {
  :global(body *) {
    visibility: hidden;
  }

  .device-qr-card,
  .device-qr-card * {
    visibility: visible;
  }

  .device-qr-card {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
  }
}
</style>
