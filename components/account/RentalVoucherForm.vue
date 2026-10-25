<script setup lang="ts">
import type { PublicRental } from '~/types/rental'
import type { PublicRentalVoucher } from '~/types/voucher'
import { applyVoucherSchema } from '~/utils/voucher-validation'

const props = defineProps<{
  rentalUuid: string
  voucher: PublicRentalVoucher | null
  editable: boolean
  centered?: boolean
}>()

const emit = defineEmits<{
  applied: [rental: PublicRental]
}>()

const toast = useToast()
const { authHeaders } = useAuth()
const { formatMoney } = useCurrency()
const code = ref('')
const pending = ref(false)
const formError = ref('')

async function applyCode() {
  formError.value = ''
  const parsed = applyVoucherSchema.safeParse({ code: code.value })
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message || 'Enter a voucher code.'
    return
  }

  pending.value = true
  try {
    const rental = await $fetch<PublicRental>(`/api/rentals/${props.rentalUuid}/voucher`, {
      method: 'POST',
      headers: authHeaders(),
      body: parsed.data,
    })
    toast.add({ title: 'Voucher applied', color: 'success' })
    code.value = ''
    emit('applied', rental)
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not apply that voucher.'
  }
  finally {
    pending.value = false
  }
}

async function removeCode() {
  formError.value = ''
  pending.value = true
  try {
    const rental = await $fetch<PublicRental>(`/api/rentals/${props.rentalUuid}/voucher`, {
      method: 'DELETE',
      headers: authHeaders(),
    })
    toast.add({ title: 'Voucher removed', color: 'success' })
    emit('applied', rental)
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not remove that voucher.'
  }
  finally {
    pending.value = false
  }
}
</script>

<template>
  <section class="storefront-card rounded-2xl p-5">
    <div
      class="flex gap-3"
      :class="centered ? 'flex-col items-center text-center' : 'items-center'"
    >
      <span class="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#f4f6f5] text-[#12201a]">
        <UIcon
          name="i-lucide-ticket-percent"
          class="size-4.5"
        />
      </span>
      <div
        class="min-w-0"
        :class="centered ? '' : 'flex-1'"
      >
        <h2 class="text-sm font-semibold text-[#12201a]">
          Voucher
        </h2>
        <p class="text-xs text-[#5b6b64]">
          Have a voucher code? Enter it below to get a discount on your rental.
        </p>
      </div>
    </div>

    <div
      v-if="voucher"
      class="mt-4 flex items-center gap-3 rounded-xl border border-dashed border-emerald-300 bg-emerald-50 px-3.5 py-3 text-left"
      :class="centered ? 'mx-auto max-w-sm' : ''"
    >
      <UIcon
        name="i-lucide-badge-check"
        class="size-5 shrink-0 text-emerald-600"
      />
      <div class="min-w-0 flex-1">
        <p class="truncate font-mono text-sm font-semibold tracking-wide text-emerald-900">
          {{ voucher.code }}
        </p>
        <p class="truncate text-xs text-emerald-800">
          {{ voucher.name }}<template v-if="voucher.discountAmount > 0">
            · saves {{ formatMoney(voucher.discountAmount) }}
          </template>
        </p>
      </div>
      <UButton
        v-if="editable"
        color="neutral"
        variant="ghost"
        size="xs"
        class="shrink-0"
        :loading="pending"
        @click="removeCode"
      >
        Remove
      </UButton>
    </div>

    <form
      v-else-if="editable"
      class="mt-4"
      @submit.prevent="applyCode"
    >
      <div
        class="flex max-w-sm gap-2"
        :class="centered ? 'mx-auto' : ''"
      >
        <UInput
          v-model="code"
          class="min-w-0 flex-1"
          :ui="{ base: 'font-mono uppercase tracking-wide' }"
          icon="i-lucide-ticket"
          placeholder="JRY-XXXXXX"
          :disabled="pending"
          autocomplete="off"
        />
        <UButton
          type="submit"
          color="neutral"
          class="shrink-0 px-4"
          :loading="pending"
          :disabled="!code.trim()"
        >
          Apply
        </UButton>
      </div>
      <p
        v-if="formError"
        class="mt-2 flex items-center gap-1.5 text-xs text-red-700"
        :class="centered ? 'justify-center' : ''"
        role="alert"
      >
        <UIcon
          name="i-lucide-circle-alert"
          class="size-3.5 shrink-0"
        />
        {{ formError }}
      </p>
    </form>

    <p
      v-if="voucher && formError"
      class="mt-2 flex items-center gap-1.5 text-xs text-red-700"
      :class="centered ? 'justify-center' : ''"
      role="alert"
    >
      <UIcon
        name="i-lucide-circle-alert"
        class="size-3.5 shrink-0"
      />
      {{ formError }}
    </p>
  </section>
</template>
