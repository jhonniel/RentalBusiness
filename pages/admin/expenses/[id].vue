<script setup lang="ts">
import type { PublicExpense } from '~/types/expense'
import { expenseUpdateSchema } from '~/utils/expense-validation'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const toast = useToast()
const identifier = computed(() => String(route.params.id))
const saving = ref(false)
const voiding = ref(false)
const formError = ref('')

const { data: expense, error, refresh } = await useFetch<PublicExpense>(
  () => `/api/admin/expenses/${identifier.value}`,
)

if (error.value?.statusCode === 404) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Expense not found',
  })
}

useSiteMeta({
  title: expense.value ? expense.value.name : 'Expense',
  path: `/admin/expenses/${identifier.value}`,
})

const locked = computed(() => expense.value?.status === 'void')

async function onSubmit(payload: Record<string, unknown>) {
  if (!expense.value) {
    return
  }

  formError.value = ''
  const parsed = expenseUpdateSchema.safeParse(payload)
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message || 'Check the expense details.'
    return
  }

  saving.value = true
  try {
    await $fetch(`/api/admin/expenses/${expense.value.uuid}`, {
      method: 'PATCH',
      body: parsed.data,
    })
    toast.add({ title: 'Expense updated', color: 'success' })
    await refresh()
  }
  catch (error) {
    const payloadError = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payloadError?.message || 'We could not update that expense.'
  }
  finally {
    saving.value = false
  }
}

async function onVoid() {
  if (!expense.value || !window.confirm('Void this expense? The row stays on file and is excluded from totals.')) {
    return
  }

  voiding.value = true
  try {
    await $fetch(`/api/admin/expenses/${expense.value.uuid}/void`, { method: 'POST' })
    toast.add({ title: 'Expense voided', color: 'success' })
    await refresh()
  }
  catch (error) {
    const payloadError = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    toast.add({
      title: payloadError?.message || 'We could not void that expense.',
      color: 'error',
    })
  }
  finally {
    voiding.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <UButton
      to="/admin/expenses"
      color="neutral"
      variant="ghost"
      class="-ml-2"
    >
      Back to expenses
    </UButton>

    <AdminNotice
      v-if="error?.statusCode === 503"
      title="Expenses are not connected"
      description="Add live Supabase credentials to manage this expense."
    />

    <template v-else-if="expense">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-wider text-lumen-700">
            Expense
          </p>
          <h2 class="mt-2 text-2xl font-medium text-stone-900">
            {{ expense.name }}
          </h2>
          <div class="mt-3">
            <StatusBadge :status="expense.status" />
          </div>
        </div>
        <UButton
          v-if="!locked"
          color="neutral"
          variant="outline"
          :loading="voiding"
          @click="onVoid"
        >
          Void
        </UButton>
      </div>

      <ExpenseEditor
        :key="expense.updatedAt"
        :initial="{
          name: expense.name,
          category: expense.category,
          description: expense.description,
          amount: expense.amount,
          vendor: expense.vendor,
          reference: expense.reference,
          status: expense.status === 'void' ? 'pending' : expense.status,
          notes: expense.notes,
          incurredOn: expense.incurredOn,
        }"
        :disabled="locked"
        :loading="saving"
        :error="formError"
        submit-label="Update expense"
        @submit="onSubmit"
      />
    </template>
  </div>
</template>
