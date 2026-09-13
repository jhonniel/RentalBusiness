<script setup lang="ts">
import type { PublicRecurringExpense } from '~/types/expense'
import { formatBusinessDate } from '~/utils/datetime'
import { recurringExpenseInputSchema } from '~/utils/expense-validation'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const toast = useToast()
const { formatMoney } = useCurrency()
const identifier = computed(() => String(route.params.id))
const saving = ref(false)
const posting = ref(false)
const formError = ref('')

const { data: item, error, refresh } = await useFetch<PublicRecurringExpense>(
  () => `/api/admin/recurring-expenses/${identifier.value}`,
)

if (error.value?.statusCode === 404) {
  throw createError({
    statusCode: 404,
    statusMessage: 'Recurring expense not found',
  })
}

useSiteMeta({
  title: item.value ? item.value.name : 'Recurring expense',
  path: `/admin/expenses/recurring/${identifier.value}`,
})

const locked = computed(() => item.value?.status === 'ended')

async function onSubmit(payload: Record<string, unknown>) {
  if (!item.value) {
    return
  }

  formError.value = ''
  const parsed = recurringExpenseInputSchema.safeParse(payload)
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message || 'Check the recurring expense details.'
    return
  }

  saving.value = true
  try {
    await $fetch(`/api/admin/recurring-expenses/${item.value.uuid}`, {
      method: 'PATCH',
      body: parsed.data,
    })
    toast.add({ title: 'Recurring expense updated', color: 'success' })
    await refresh()
  }
  catch (error) {
    const payloadError = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payloadError?.message || 'We could not update that recurring expense.'
  }
  finally {
    saving.value = false
  }
}

async function runAction(path: string, title: string, confirmMessage?: string) {
  if (!item.value) {
    return
  }
  if (confirmMessage && !window.confirm(confirmMessage)) {
    return
  }

  try {
    await $fetch(`/api/admin/recurring-expenses/${item.value.uuid}/${path}`, { method: 'POST' })
    toast.add({ title, color: 'success' })
    await refresh()
  }
  catch (error) {
    const payloadError = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    toast.add({
      title: payloadError?.message || 'We could not update that recurring expense.',
      color: 'error',
    })
  }
}

async function onPost() {
  posting.value = true
  try {
    await runAction('occurrences', 'Occurrence posted')
  }
  finally {
    posting.value = false
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-6">
    <UButton
      to="/admin/expenses/recurring"
      color="neutral"
      variant="ghost"
      class="-ml-2"
    >
      Back to recurring expenses
    </UButton>

    <AdminNotice
      v-if="error?.statusCode === 503"
      title="Recurring expenses are not connected"
      description="Add live Supabase credentials to manage this template."
    />

    <template v-else-if="item">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p class="text-xs uppercase tracking-wider text-lumen-700">
            Recurring
          </p>
          <h2 class="mt-2 text-2xl font-medium text-stone-900">
            {{ item.name }}
          </h2>
          <p class="mt-2 text-sm text-stone-500">
            Next {{ formatBusinessDate(item.nextOccurrenceOn) }} · {{ formatMoney(item.amount) }}
          </p>
          <div class="mt-3">
            <StatusBadge :status="item.status" />
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          <UButton
            v-if="item.status === 'active'"
            :loading="posting"
            @click="onPost"
          >
            Post next
          </UButton>
          <UButton
            v-if="item.status === 'active'"
            color="neutral"
            variant="outline"
            @click="runAction('pause', 'Recurring expense paused')"
          >
            Pause
          </UButton>
          <UButton
            v-if="item.status === 'paused'"
            color="neutral"
            variant="outline"
            @click="runAction('resume', 'Recurring expense resumed')"
          >
            Resume
          </UButton>
          <UButton
            v-if="item.status !== 'ended'"
            color="neutral"
            variant="outline"
            @click="runAction('end', 'Recurring expense ended', 'End this recurring expense? Existing occurrences stay on file.')"
          >
            End
          </UButton>
        </div>
      </div>

      <RecurringExpenseEditor
        :key="item.updatedAt"
        :initial="item"
        :disabled="locked"
        :loading="saving"
        :error="formError"
        submit-label="Update recurring expense"
        @submit="onSubmit"
      />

      <section class="rounded-xl border border-stone-200 bg-white p-5">
        <h3 class="text-sm font-medium text-stone-900">
          Occurrences
        </h3>
        <ul
          v-if="item.occurrences?.length"
          class="mt-3 divide-y divide-stone-100"
        >
          <li
            v-for="occurrence in item.occurrences"
            :key="occurrence.uuid"
            class="flex flex-wrap items-center justify-between gap-3 py-3 text-sm"
          >
            <div>
              <p>{{ formatBusinessDate(occurrence.occursOn) }}</p>
              <p
                v-if="occurrence.expense"
                class="text-stone-500"
              >
                {{ occurrence.expense.name }}
              </p>
            </div>
            <div
              v-if="occurrence.expense"
              class="flex items-center gap-3"
            >
              <NuxtLink
                :to="`/admin/expenses/${occurrence.expense.uuid}`"
                class="text-lumen-700 hover:underline"
              >
                {{ formatMoney(occurrence.expense.amount) }}
              </NuxtLink>
              <StatusBadge :status="occurrence.expense.status" />
            </div>
          </li>
        </ul>
        <p
          v-else
          class="mt-3 text-sm text-stone-500"
        >
          No occurrences posted yet.
        </p>
      </section>
    </template>
  </div>
</template>
