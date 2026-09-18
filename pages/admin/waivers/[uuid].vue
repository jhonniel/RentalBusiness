<script setup lang="ts">
definePageMeta({
  layout: 'admin',
  middleware: 'admin',
})

const route = useRoute()
const { authHeaders } = useAuth()
const uuid = computed(() => String(route.params.uuid))
const pdfUrl = ref('')
const filename = computed(() => `JRY-waiver-${uuid.value}.pdf`)
const pending = ref(true)
const loadError = ref('')

async function loadPdf() {
  pending.value = true
  loadError.value = ''
  try {
    const blob = await $fetch<Blob>(`/api/admin/waivers/${uuid.value}/pdf`, {
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
  path: `/admin/waivers/${uuid.value}`,
})
</script>

<template>
  <div class="w-full space-y-6">
    <UButton
      to="/admin/waivers"
      color="neutral"
      variant="ghost"
      class="-ml-2"
    >
      Back to waivers
    </UButton>

    <div>
      <p class="text-xs font-medium uppercase tracking-[0.22em] text-lumen-700">
        Legal
      </p>
      <h2 class="mt-2 text-2xl font-medium text-stone-900">
        Waiver PDF
      </h2>
      <p class="mt-1 text-sm text-stone-600">
        View, download, or print this published waiver version.
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
