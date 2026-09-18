<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const { authHeaders } = useAuth()
const identifier = computed(() => String(route.params.id))
const pdfUrl = ref('')
const filename = computed(() => `JRY-waiver-${identifier.value}.pdf`)
const pending = ref(true)
const loadError = ref('')

async function loadPdf() {
  pending.value = true
  loadError.value = ''
  try {
    const blob = await $fetch<Blob>(`/api/admin/rentals/${identifier.value}/waiver-pdf`, {
      responseType: 'blob',
      headers: authHeaders(),
    })
    if (pdfUrl.value) {
      URL.revokeObjectURL(pdfUrl.value)
    }
    pdfUrl.value = URL.createObjectURL(blob)
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    loadError.value = payload?.message || 'We could not load that waiver PDF.'
  }
  finally {
    pending.value = false
  }
}

onMounted(loadPdf)
onUnmounted(() => {
  if (pdfUrl.value) {
    URL.revokeObjectURL(pdfUrl.value)
  }
})

useSiteMeta({
  title: 'Waiver PDF',
  path: `/admin/rentals/${identifier.value}/waiver`,
})
</script>

<template>
  <div class="w-full space-y-6">
    <UButton
      :to="`/admin/rentals/${identifier}`"
      color="neutral"
      variant="ghost"
      class="-ml-2"
    >
      Back to rental
    </UButton>

    <div>
      <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
        Legal
      </p>
      <h2 class="mt-2 text-2xl font-medium text-stone-900">
        Waiver PDF
      </h2>
      <p class="mt-1 text-sm text-stone-600">
        View, download, or print the signed rental agreement.
      </p>
    </div>

    <AdminNotice
      v-if="loadError"
      title="Waiver PDF is not available"
      :description="loadError"
    />
    <USkeleton
      v-else-if="pending"
      class="h-[calc(100dvh-11rem)] min-h-[36rem] w-full"
    />
    <AdminWaiverPdfViewer
      v-else-if="pdfUrl"
      :src="pdfUrl"
      :filename="filename"
    />
  </div>
</template>
