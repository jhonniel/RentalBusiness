<script setup lang="ts">
import type { AdminFaqListResponse, PublicFaq } from '~/types/faq'
import { faqInputSchema } from '~/utils/faq-validation'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'FAQs',
  path: '/admin/faqs',
})

const toast = useToast()
const { data, error, pending, refresh } = await useFetch<AdminFaqListResponse>('/api/admin/faqs')
const unavailable = computed(() => error.value?.statusCode === 503)
const ready = computed(() => data.value?.ready ?? false)
const items = computed(() => data.value?.items ?? [])

const form = reactive({
  question: '',
  answer: '',
  sortOrder: 0,
  isActive: true,
})
const editingUuid = ref<string | null>(null)
const formError = ref('')
const saving = ref(false)
const busyUuid = ref<string | null>(null)

function nextSortOrder() {
  return items.value.reduce((max, faq) => Math.max(max, faq.sortOrder), 0) + 10
}

function resetForm() {
  editingUuid.value = null
  form.question = ''
  form.answer = ''
  form.sortOrder = nextSortOrder()
  form.isActive = true
  formError.value = ''
}

watch(items, () => {
  if (!editingUuid.value && !form.question && !form.answer) {
    form.sortOrder = nextSortOrder()
  }
}, { immediate: true })

function startEdit(faq: PublicFaq) {
  editingUuid.value = faq.uuid
  form.question = faq.question
  form.answer = faq.answer
  form.sortOrder = faq.sortOrder
  form.isActive = faq.isActive
  formError.value = ''
}

function errorMessage(error: unknown, fallback: string) {
  const payload = typeof error === 'object' && error && 'data' in error
    ? (error as { data?: { message?: string } }).data
    : null
  return payload?.message || fallback
}

function patchFaq(faq: PublicFaq, changes: Partial<PublicFaq>) {
  return $fetch<PublicFaq>(`/api/admin/faqs/${faq.uuid}`, {
    method: 'PATCH',
    body: {
      question: changes.question ?? faq.question,
      answer: changes.answer ?? faq.answer,
      sortOrder: changes.sortOrder ?? faq.sortOrder,
      isActive: changes.isActive ?? faq.isActive,
    },
  })
}

async function onSubmit() {
  formError.value = ''
  const parsed = faqInputSchema.safeParse(form)
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message || 'Check the FAQ.'
    return
  }

  saving.value = true
  try {
    await (editingUuid.value
      ? $fetch<PublicFaq>(`/api/admin/faqs/${editingUuid.value}`, { method: 'PATCH', body: parsed.data })
      : $fetch<PublicFaq>('/api/admin/faqs', { method: 'POST', body: parsed.data }))
    toast.add({ title: editingUuid.value ? 'FAQ updated' : 'FAQ added', color: 'success' })
    await refresh()
    resetForm()
  }
  catch (error) {
    formError.value = errorMessage(error, 'We could not save that FAQ.')
  }
  finally {
    saving.value = false
  }
}

async function toggleActive(faq: PublicFaq) {
  busyUuid.value = faq.uuid
  try {
    await patchFaq(faq, { isActive: !faq.isActive })
    toast.add({ title: faq.isActive ? 'FAQ hidden' : 'FAQ shown', color: 'success' })
    await refresh()
  }
  catch (error) {
    toast.add({ title: errorMessage(error, 'We could not update that FAQ.'), color: 'error' })
  }
  finally {
    busyUuid.value = null
  }
}

async function move(index: number, direction: -1 | 1) {
  const current = items.value[index]
  const other = items.value[index + direction]
  if (!current || !other) {
    return
  }

  busyUuid.value = current.uuid
  try {
    const currentOrder = current.sortOrder === other.sortOrder ? other.sortOrder + direction : other.sortOrder
    await Promise.all([
      patchFaq(current, { sortOrder: Math.max(0, currentOrder) }),
      patchFaq(other, { sortOrder: current.sortOrder }),
    ])
    await refresh()
  }
  catch (error) {
    toast.add({ title: errorMessage(error, 'We could not reorder the FAQs.'), color: 'error' })
  }
  finally {
    busyUuid.value = null
  }
}

async function removeFaq(faq: PublicFaq) {
  if (!window.confirm(`Delete "${faq.question}"? To keep it for later, hide it instead.`)) {
    return
  }

  busyUuid.value = faq.uuid
  try {
    await $fetch(`/api/admin/faqs/${faq.uuid}`, { method: 'DELETE' })
    toast.add({ title: 'FAQ deleted', color: 'success' })
    if (editingUuid.value === faq.uuid) {
      resetForm()
    }
    await refresh()
  }
  catch (error) {
    toast.add({ title: errorMessage(error, 'We could not delete that FAQ.'), color: 'error' })
  }
  finally {
    busyUuid.value = null
  }
}
</script>

<template>
  <div class="w-full space-y-6">
    <div class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
          Support
        </p>
        <h2 class="mt-2 text-2xl font-medium text-stone-900">
          FAQs
        </h2>
        <p class="mt-1 text-sm text-stone-600">
          Shown on the public FAQ page. The chat support also learns from every FAQ that is shown.
        </p>
      </div>
      <UButton
        to="/faq"
        target="_blank"
        color="neutral"
        variant="outline"
        icon="i-lucide-external-link"
      >
        View FAQ page
      </UButton>
    </div>

    <AdminNotice
      v-if="unavailable"
      title="FAQs are not connected"
      description="Add live Supabase credentials to manage FAQs."
    />

    <template v-else>
      <AdminNotice
        v-if="data && !ready"
        title="Paste the FAQs SQL to start editing"
        description="Run supabase/migrations/20261026010000_faqs.sql in the Supabase SQL editor. Until then, the FAQ page and chat use the starter FAQs below."
      />

      <div class="grid gap-6 xl:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] xl:items-start">
        <form
          class="rounded-xl border border-stone-200 bg-white p-5"
          method="post"
          @submit.prevent="onSubmit"
        >
          <h3 class="text-sm font-medium text-stone-900">
            {{ editingUuid ? 'Edit FAQ' : 'New FAQ' }}
          </h3>
          <AuthAlert
            v-if="formError"
            class="mt-4"
            :description="formError"
          />
          <div class="mt-4 space-y-4">
            <label class="block text-sm">
              <span class="mb-1.5 block text-stone-700">Question</span>
              <UInput
                v-model="form.question"
                class="w-full"
                maxlength="200"
                placeholder="Do you deliver?"
                :disabled="saving || !ready"
              />
            </label>
            <label class="block text-sm">
              <span class="mb-1.5 flex items-center justify-between text-stone-700">
                Answer
                <span class="text-xs text-stone-400">{{ form.answer.length }} / 2000</span>
              </span>
              <UTextarea
                v-model="form.answer"
                class="w-full"
                :rows="6"
                autoresize
                maxlength="2000"
                placeholder="Write the answer customers and the chat should give."
                :disabled="saving || !ready"
              />
            </label>
            <div class="grid gap-4 sm:grid-cols-2">
              <label class="block text-sm">
                <span class="mb-1.5 block text-stone-700">Order</span>
                <UInput
                  v-model="form.sortOrder"
                  type="number"
                  min="0"
                  step="10"
                  :disabled="saving || !ready"
                />
              </label>
              <div class="flex items-end pb-2 text-sm">
                <USwitch
                  v-model="form.isActive"
                  label="Show on site and chat"
                  :disabled="saving || !ready"
                />
              </div>
            </div>
          </div>
          <div class="mt-5 flex flex-wrap gap-2">
            <UButton
              type="submit"
              :loading="saving"
              :disabled="!ready"
            >
              {{ editingUuid ? 'Save FAQ' : 'Add FAQ' }}
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
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-medium text-stone-900">
              {{ items.length }} FAQ{{ items.length === 1 ? '' : 's' }}
            </h3>
            <p class="text-xs text-stone-500">
              Lower order shows first.
            </p>
          </div>

          <p
            v-if="pending && !data"
            class="mt-6 text-sm text-stone-500"
          >
            Loading FAQs…
          </p>
          <p
            v-else-if="!items.length"
            class="mt-6 text-sm text-stone-500"
          >
            No FAQs yet. Add the first one.
          </p>
          <ul
            v-else
            class="mt-4 divide-y divide-stone-100"
          >
            <li
              v-for="(faq, index) in items"
              :key="faq.uuid"
              class="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between"
              :class="faq.isActive ? '' : 'opacity-60'"
            >
              <div class="min-w-0">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="font-medium text-stone-900">
                    {{ faq.question }}
                  </p>
                  <UBadge
                    v-if="!faq.isActive"
                    color="neutral"
                    variant="soft"
                    size="sm"
                  >
                    Hidden
                  </UBadge>
                </div>
                <p class="mt-1 line-clamp-3 whitespace-pre-line text-sm text-stone-600">
                  {{ faq.answer }}
                </p>
                <p class="mt-1 text-xs text-stone-400">
                  Order {{ faq.sortOrder }}
                </p>
              </div>
              <div
                v-if="ready"
                class="flex shrink-0 flex-wrap gap-1.5"
              >
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-arrow-up"
                  aria-label="Move up"
                  :disabled="index === 0 || Boolean(busyUuid)"
                  @click="move(index, -1)"
                />
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  icon="i-lucide-arrow-down"
                  aria-label="Move down"
                  :disabled="index === items.length - 1 || Boolean(busyUuid)"
                  @click="move(index, 1)"
                />
                <UButton
                  color="neutral"
                  variant="outline"
                  size="xs"
                  :disabled="Boolean(busyUuid)"
                  @click="startEdit(faq)"
                >
                  Edit
                </UButton>
                <UButton
                  color="neutral"
                  variant="ghost"
                  size="xs"
                  :loading="busyUuid === faq.uuid"
                  :disabled="Boolean(busyUuid) && busyUuid !== faq.uuid"
                  @click="toggleActive(faq)"
                >
                  {{ faq.isActive ? 'Hide' : 'Show' }}
                </UButton>
                <UButton
                  color="error"
                  variant="ghost"
                  size="xs"
                  :disabled="Boolean(busyUuid)"
                  @click="removeFaq(faq)"
                >
                  Delete
                </UButton>
              </div>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>
