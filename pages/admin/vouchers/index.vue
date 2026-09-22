<script setup lang="ts">
import type { PublicVoucher, VoucherListResponse } from '~/types/voucher'
import { VOUCHER_DISCOUNT_TYPES, VOUCHER_STATUSES } from '~/utils/constants'
import { generateVoucherCode } from '~/utils/voucher'
import { voucherInputSchema } from '~/utils/voucher-validation'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Vouchers',
  path: '/admin/vouchers',
})

const toast = useToast()
const { formatMoney } = useCurrency()
const search = ref('')
const status = ref('')
const page = ref(1)

const { data, error, pending, refresh } = await useFetch<VoucherListResponse>('/api/admin/vouchers', {
  query: computed(() => ({
    search: search.value || undefined,
    status: status.value || undefined,
    page: page.value,
  })),
})
const unavailable = computed(() => error.value?.statusCode === 503)

const form = reactive({
  name: '',
  code: '',
  discountType: 'percent' as (typeof VOUCHER_DISCOUNT_TYPES)[number],
  discountValue: 10,
  maxRedemptions: '' as number | string,
  minSubtotal: 0,
  startsOn: '',
  endsOn: '',
  status: 'active' as (typeof VOUCHER_STATUSES)[number],
})
const editingUuid = ref<string | null>(null)
const formError = ref('')
const saving = ref(false)

function resetForm() {
  editingUuid.value = null
  form.name = ''
  form.code = ''
  form.discountType = 'percent'
  form.discountValue = 10
  form.maxRedemptions = ''
  form.minSubtotal = 0
  form.startsOn = ''
  form.endsOn = ''
  form.status = 'active'
  formError.value = ''
}

function startEdit(voucher: PublicVoucher) {
  editingUuid.value = voucher.uuid
  form.name = voucher.name
  form.code = voucher.code
  form.discountType = voucher.discountType
  form.discountValue = voucher.discountValue
  form.maxRedemptions = voucher.maxRedemptions ?? ''
  form.minSubtotal = voucher.minSubtotal
  form.startsOn = voucher.startsOn ?? ''
  form.endsOn = voucher.endsOn ?? ''
  form.status = voucher.status
}

function fillCode() {
  form.code = generateVoucherCode()
}

function discountLabel(voucher: PublicVoucher) {
  return voucher.discountType === 'percent'
    ? `${voucher.discountValue}%`
    : formatMoney(voucher.discountValue)
}

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code)
    toast.add({ title: 'Code copied', color: 'success' })
  }
  catch {
    toast.add({ title: 'Could not copy that code.', color: 'error' })
  }
}

async function onSubmit() {
  formError.value = ''
  const parsed = voucherInputSchema.safeParse(form)
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message || 'Check the voucher details.'
    return
  }

  saving.value = true
  try {
    await (editingUuid.value
      ? $fetch<PublicVoucher>(`/api/admin/vouchers/${editingUuid.value}`, {
          method: 'PATCH',
          body: parsed.data,
        })
      : $fetch<PublicVoucher>('/api/admin/vouchers', {
          method: 'POST',
          body: parsed.data,
        }))
    toast.add({ title: editingUuid.value ? 'Voucher updated' : 'Voucher created', color: 'success' })
    resetForm()
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not save that voucher.'
  }
  finally {
    saving.value = false
  }
}

async function disableVoucher(voucher: PublicVoucher) {
  formError.value = ''
  try {
    await $fetch(`/api/admin/vouchers/${voucher.uuid}`, {
      method: 'PATCH',
      body: {
        name: voucher.name,
        code: voucher.code,
        discountType: voucher.discountType,
        discountValue: voucher.discountValue,
        maxRedemptions: voucher.maxRedemptions,
        minSubtotal: voucher.minSubtotal,
        startsOn: voucher.startsOn,
        endsOn: voucher.endsOn,
        status: 'disabled',
      },
    })
    toast.add({ title: 'Voucher disabled', color: 'success' })
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not disable that voucher.'
  }
}
</script>

<template>
  <div class="w-full space-y-6">
    <div>
      <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
        Finance
      </p>
      <h2 class="mt-2 text-2xl font-medium text-stone-900">
        Vouchers
      </h2>
      <p class="mt-1 text-sm text-stone-600">
        Generate a code to give a customer. They enter it at checkout to reduce the rental total.
      </p>
    </div>

    <AdminNotice
      v-if="unavailable"
      title="Vouchers are not connected"
      description="Add live Supabase credentials and apply the vouchers migration to create discount codes."
    />

    <template v-else>
      <div class="grid gap-6 xl:grid-cols-2 xl:items-start">
        <form
          class="rounded-xl border border-stone-200 bg-white p-5"
          method="post"
          @submit.prevent="onSubmit"
        >
          <h3 class="text-sm font-medium text-stone-900">
            {{ editingUuid ? 'Edit voucher' : 'New voucher' }}
          </h3>
          <AuthAlert
            v-if="formError"
            class="mt-4"
            :description="formError"
          />
          <div class="mt-4 grid gap-4 sm:grid-cols-2">
            <label class="block text-sm sm:col-span-2">
              <span class="mb-1.5 block text-stone-700">Name</span>
              <UInput
                v-model="form.name"
                placeholder="Welcome 10%"
                :disabled="saving"
              />
            </label>
            <label class="block text-sm sm:col-span-2">
              <span class="mb-1.5 block text-stone-700">Code</span>
              <div class="flex gap-2">
                <UInput
                  v-model="form.code"
                  class="flex-1"
                  placeholder="Leave blank to generate"
                  :disabled="saving"
                />
                <UButton
                  color="neutral"
                  variant="outline"
                  type="button"
                  :disabled="saving"
                  @click="fillCode"
                >
                  Generate
                </UButton>
              </div>
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Type</span>
              <select
                v-model="form.discountType"
                class="w-full rounded-md border border-stone-200 bg-white px-3 py-2"
                :disabled="saving"
              >
                <option
                  v-for="item in VOUCHER_DISCOUNT_TYPES"
                  :key="item"
                  :value="item"
                >
                  {{ item === 'percent' ? 'Percent' : 'Fixed ₱' }}
                </option>
              </select>
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">
                {{ form.discountType === 'percent' ? 'Percent' : 'Amount (₱)' }}
              </span>
              <UInput
                v-model="form.discountValue"
                type="number"
                min="0.01"
                step="0.01"
                :disabled="saving"
              />
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Max uses</span>
              <UInput
                v-model="form.maxRedemptions"
                type="number"
                min="1"
                placeholder="Unlimited"
                :disabled="saving"
              />
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Minimum subtotal (₱)</span>
              <UInput
                v-model="form.minSubtotal"
                type="number"
                min="0"
                step="0.01"
                :disabled="saving"
              />
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Starts on</span>
              <UInput
                v-model="form.startsOn"
                type="date"
                :disabled="saving"
              />
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Ends on</span>
              <UInput
                v-model="form.endsOn"
                type="date"
                :disabled="saving"
              />
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Status</span>
              <select
                v-model="form.status"
                class="w-full rounded-md border border-stone-200 bg-white px-3 py-2"
                :disabled="saving"
              >
                <option
                  v-for="item in VOUCHER_STATUSES"
                  :key="item"
                  :value="item"
                >
                  {{ item }}
                </option>
              </select>
            </label>
          </div>
          <div class="mt-5 flex flex-wrap gap-2">
            <UButton
              type="submit"
              :loading="saving"
            >
              {{ editingUuid ? 'Save voucher' : 'Create voucher' }}
            </UButton>
            <UButton
              v-if="editingUuid"
              color="neutral"
              variant="outline"
              type="button"
              :disabled="saving"
              @click="resetForm"
            >
              Cancel
            </UButton>
          </div>
        </form>

        <section class="rounded-xl border border-stone-200 bg-white p-5">
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              v-model="search"
              class="w-full rounded-md border border-stone-200 px-3 py-2 text-sm sm:flex-1"
              placeholder="Search code or name"
            >
            <select
              v-model="status"
              class="rounded-md border border-stone-200 px-3 py-2 text-sm"
            >
              <option value="">
                All statuses
              </option>
              <option
                v-for="item in VOUCHER_STATUSES"
                :key="item"
                :value="item"
              >
                {{ item }}
              </option>
            </select>
          </div>

          <p
            v-if="pending"
            class="mt-6 text-sm text-stone-500"
          >
            Loading vouchers…
          </p>
          <p
            v-else-if="!data?.items.length"
            class="mt-6 text-sm text-stone-500"
          >
            No vouchers yet.
          </p>
          <ul
            v-else
            class="mt-4 divide-y divide-stone-100"
          >
            <li
              v-for="voucher in data.items"
              :key="voucher.uuid"
              class="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
            >
              <div class="min-w-0">
                <p class="font-medium text-stone-900">
                  {{ voucher.code }}
                </p>
                <p class="mt-0.5 text-sm text-stone-600">
                  {{ voucher.name }} · {{ discountLabel(voucher) }}
                </p>
                <p class="mt-1 text-xs text-stone-500">
                  Used {{ voucher.redeemedCount }}{{ voucher.maxRedemptions ? ` / ${voucher.maxRedemptions}` : '' }}
                </p>
                <div class="mt-2">
                  <StatusBadge :status="voucher.displayStatus" />
                </div>
              </div>
              <div class="flex flex-wrap gap-2">
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click="copyCode(voucher.code)"
                >
                  Copy
                </UButton>
                <UButton
                  color="neutral"
                  variant="outline"
                  size="xs"
                  @click="startEdit(voucher)"
                >
                  Edit
                </UButton>
                <UButton
                  v-if="voucher.status !== 'disabled'"
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  @click="disableVoucher(voucher)"
                >
                  Disable
                </UButton>
              </div>
            </li>
          </ul>
          <div
            v-if="data && data.total > data.pageSize"
            class="mt-4 flex items-center justify-between text-sm"
          >
            <UButton
              color="neutral"
              variant="outline"
              size="xs"
              :disabled="page <= 1"
              @click="page -= 1"
            >
              Previous
            </UButton>
            <span class="text-stone-500">
              Page {{ data.page }}
            </span>
            <UButton
              color="neutral"
              variant="outline"
              size="xs"
              :disabled="data.page * data.pageSize >= data.total"
              @click="page += 1"
            >
              Next
            </UButton>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
