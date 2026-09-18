<script setup lang="ts">
import type { PublicWaiverVersion } from '~/types/waiver'
import { publishWaiverSchema } from '~/utils/waiver-validation'

definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

useSiteMeta({
  title: 'Waivers',
  path: '/admin/waivers',
})

const toast = useToast()
const { data: versions, error, pending, refresh } = await useFetch<PublicWaiverVersion[]>('/api/admin/waivers')
const unavailable = computed(() => error.value?.statusCode === 503)

const form = reactive({
  version: '',
  title: '',
  body: '',
})
const formError = ref('')
const saving = ref(false)

async function onSubmit() {
  formError.value = ''
  const parsed = publishWaiverSchema.safeParse(form)
  if (!parsed.success) {
    formError.value = parsed.error.issues[0]?.message || 'Check the waiver details.'
    return
  }

  saving.value = true
  try {
    await $fetch('/api/admin/waivers', {
      method: 'POST',
      body: parsed.data,
    })
    toast.add({ title: 'Waiver published', color: 'success' })
    form.version = ''
    form.title = ''
    form.body = ''
    await refresh()
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not publish that waiver.'
  }
  finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="w-full space-y-6">
    <div>
      <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
        Legal
      </p>
      <h2 class="mt-2 text-2xl font-medium text-stone-900">
        Waivers
      </h2>
      <p class="mt-1 text-sm text-stone-600">
        Publish a new current version. Accepted copies stay bound to the version the customer signed.
      </p>
    </div>

    <AdminNotice
      v-if="unavailable"
      title="Waivers are not connected"
      description="Add live Supabase credentials and apply every migration to publish waiver versions."
    />

    <template v-else>
      <div class="grid gap-6 xl:grid-cols-2 xl:items-start">
        <form
          class="rounded-xl border border-stone-200 bg-white p-5"
          method="post"
          @submit.prevent="onSubmit"
        >
        <h3 class="text-sm font-medium text-stone-900">
          Publish new version
        </h3>
        <AuthAlert
          v-if="formError"
          class="mt-4"
          :description="formError"
        />
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <label class="block text-sm">
            <span class="mb-1.5 block text-stone-700">Version</span>
            <UInput
              v-model="form.version"
              placeholder="JRY-WAIVER-v1.2"
              :disabled="saving"
            />
          </label>
          <label class="block text-sm">
            <span class="mb-1.5 block text-stone-700">Title</span>
            <UInput
              v-model="form.title"
              :disabled="saving"
            />
          </label>
          <label class="block text-sm sm:col-span-2">
            <span class="mb-1.5 block text-stone-700">Terms</span>
            <UTextarea
              v-model="form.body"
              :rows="8"
              :disabled="saving"
            />
          </label>
        </div>
        <div class="mt-4">
          <UButton
            type="submit"
            :loading="saving"
          >
            Publish as current
          </UButton>
        </div>
      </form>

      <div class="space-y-3">
        <div
          v-if="pending && !versions"
          class="space-y-3"
        >
          <USkeleton class="h-24 w-full" />
          <USkeleton class="h-24 w-full" />
        </div>

        <AdminNotice
          v-else-if="!versions?.length"
          title="No waiver versions"
          description="Publish the first current waiver before customers can sign."
        />

        <ul
          v-else
          class="divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white"
        >
          <li
            v-for="item in versions"
            :key="item.uuid"
            class="px-4 py-4"
          >
            <div class="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p class="font-medium text-stone-900">
                  {{ item.title }}
                </p>
                <p class="text-sm text-stone-500">
                  Version {{ item.version }}
                </p>
              </div>
              <div class="flex flex-wrap items-center gap-2">
                <StatusBadge :status="item.isCurrent ? 'active' : 'archived'" />
                <UButton
                  :to="`/admin/waivers/${item.uuid}`"
                  color="neutral"
                  variant="outline"
                  size="xs"
                >
                  View PDF
                </UButton>
              </div>
            </div>
            <p class="mt-3 line-clamp-3 whitespace-pre-wrap text-sm text-stone-600">
              {{ item.body }}
            </p>
          </li>
        </ul>
      </div>
      </div>
    </template>
  </div>
</template>
