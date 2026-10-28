<script setup lang="ts">
import type { FeedbackRewardSettingsResponse } from '~/types/feedback'
import type { PublicVoucher, VoucherListResponse } from '~/types/voucher'
import { formatBusinessDate } from '~/utils/datetime'
import { FEEDBACK_REWARD_MIN_COMMENT, feedbackRewardLabel, feedbackRewardSettingsSchema } from '~/utils/feedback-reward'

const props = withDefaults(defineProps<{
  compact?: boolean
}>(), {
  compact: false,
})

const toast = useToast()
const { data, refresh } = useFetch<FeedbackRewardSettingsResponse>('/api/admin/feedback/reward')
const { data: vouchers } = useFetch<VoucherListResponse>('/api/admin/vouchers', {
  query: { page: 1, pageSize: 50 },
  immediate: !props.compact,
})

const form = reactive({
  enabled: false,
  voucherUuid: '' as string,
})
const saving = ref(false)
const formError = ref('')

watch(data, (value) => {
  if (value) {
    form.enabled = value.enabled
    form.voucherUuid = value.voucherUuid ?? ''
  }
}, { immediate: true })

const options = computed(() => {
  const items = (vouchers.value?.items ?? []).filter(item => item.status !== 'disabled' && !item.name.startsWith('Feedback · '))
  const current = data.value?.voucher
  if (current && !items.some(item => item.uuid === current.uuid)) {
    items.unshift({ uuid: current.uuid, code: current.code, name: current.name, discountType: 'fixed', discountValue: 0, maxRedemptions: current.maxRedemptions, redeemedCount: current.redeemedCount, minSubtotal: 0, startsOn: null, endsOn: current.endsOn, status: current.status, displayStatus: current.status, createdAt: '' } as PublicVoucher)
  }
  return items
})

function optionLabel(voucher: PublicVoucher) {
  const discount = voucher.discountValue
    ? feedbackRewardLabel({ discountType: voucher.discountType, discountValue: voucher.discountValue }).replace(' off your next rental', ' off')
    : ''
  const limit = voucher.maxRedemptions ? `${voucher.maxRedemptions} unique codes` : 'no limit'
  return [voucher.code, voucher.name, discount, limit, voucher.status === 'draft' ? 'draft' : ''].filter(Boolean).join(' · ')
}

const dirty = computed(() => Boolean(data.value) && (
  form.enabled !== data.value!.enabled
  || (form.voucherUuid || null) !== data.value!.voucherUuid
))

const stockText = computed(() => {
  const value = data.value
  if (!value?.voucher) {
    return ''
  }
  if (value.left === null) {
    return `${value.given} unique codes given · no limit`
  }
  return `${value.given} unique codes given · ${value.left} of ${value.voucher.maxRedemptions} left`
})

async function save() {
  formError.value = ''
  const parsed = feedbackRewardSettingsSchema.safeParse({ enabled: form.enabled, voucherUuid: form.voucherUuid || null })
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message || 'Check the voucher settings.'
    return
  }
  saving.value = true
  try {
    await $fetch('/api/admin/feedback/reward', { method: 'PUT', body: parsed.data })
    toast.add({ title: parsed.data.enabled ? 'Feedback voucher is on' : 'Feedback voucher saved', color: 'success' })
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not save the feedback voucher.'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <section
    v-if="compact"
    class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4"
  >
    <p class="flex min-w-0 flex-wrap items-center gap-2 text-sm text-stone-700">
      <UIcon
        name="i-lucide-ticket"
        class="size-4 text-stone-500"
      />
      <span class="font-medium text-stone-900">Thank-you voucher:</span>
      <template v-if="data?.enabled && data.voucher">
        {{ data.voucher.code }} · {{ data.voucher.label }} · {{ stockText }}
        <span
          v-if="data.unavailableReason"
          class="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"
        >{{ data.unavailableReason }} Customers only see the thank-you message.</span>
      </template>
      <template v-else>
        Off
      </template>
    </p>
    <UButton
      to="/admin/vouchers#feedback-voucher"
      color="neutral"
      variant="outline"
      size="sm"
    >
      Set in Vouchers
    </UButton>
  </section>

  <section
    v-else
    id="feedback-voucher"
    class="scroll-mt-24 rounded-xl border border-stone-200 bg-white p-5"
  >
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div class="min-w-0">
        <h3 class="flex items-center gap-2 text-sm font-medium text-stone-900">
          <UIcon
            name="i-lucide-gift"
            class="size-4 text-stone-500"
          />
          Feedback thank-you voucher
        </h3>
        <p class="mt-1 max-w-2xl text-sm text-stone-600">
          Pick a voucher to use as the template. When a customer rates every question and writes a comment (at least {{ FEEDBACK_REWARD_MIN_COMMENT }} characters), they get their own one-time code with the same discount, minimum, and end date. Tip: keep the template as Draft so its own code cannot be used at checkout. The template's Max uses is how many unique codes can be given. When they run out, or the voucher ends or is disabled, customers only see the thank-you message.
        </p>
      </div>
      <USwitch
        v-model="form.enabled"
        :label="form.enabled ? 'On' : 'Off'"
        :disabled="saving || data?.ready === false"
      />
    </div>

    <AdminNotice
      v-if="data?.ready === false"
      class="mt-4"
      title="Paste the reward SQL to turn this on"
      description="Run supabase/migrations/20261028020000_feedback_reward_voucher.sql in the Supabase SQL editor."
    />

    <div class="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <label class="block text-sm">
        <span class="mb-1.5 block text-stone-700">Voucher to give</span>
        <select
          v-model="form.voucherUuid"
          class="w-full rounded-md border border-stone-200 bg-white px-3 py-2"
          :disabled="saving"
        >
          <option value="">
            Choose a template voucher
          </option>
          <option
            v-for="voucher in options"
            :key="voucher.uuid"
            :value="voucher.uuid"
          >
            {{ optionLabel(voucher) }}
          </option>
        </select>
      </label>
      <UButton
        :loading="saving"
        :disabled="!dirty"
        class="justify-center"
        @click="save"
      >
        Save
      </UButton>
    </div>

    <p
      v-if="!options.length && vouchers"
      class="mt-3 text-sm text-stone-500"
    >
      No vouchers yet. Create one below with a Max uses limit, then choose it here.
    </p>

    <div
      v-if="data?.voucher && data.voucherUuid === (form.voucherUuid || null)"
      class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-stone-50 px-3 py-2 text-sm"
    >
      <span class="font-medium tracking-wider text-stone-900">{{ data.voucher.code }}</span>
      <span class="text-stone-600">{{ data.voucher.label }}</span>
      <span class="text-stone-600">{{ stockText }}</span>
      <span
        v-if="data.voucher.endsOn"
        class="text-stone-600"
      >Ends {{ formatBusinessDate(data.voucher.endsOn) }}</span>
      <span
        v-if="data.enabled && data.unavailableReason"
        class="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800"
      >{{ data.unavailableReason }} Customers only see the thank-you message.</span>
      <span
        v-else-if="data.open"
        class="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700"
      >Giving codes</span>
    </div>

    <p
      v-if="formError"
      class="mt-3 text-sm text-red-800"
    >
      {{ formError }}
    </p>
  </section>
</template>
