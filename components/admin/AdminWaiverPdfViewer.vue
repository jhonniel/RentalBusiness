<script setup lang="ts">
const props = defineProps<{
  src: string
  filename: string
}>()

function download() {
  const link = document.createElement('a')
  link.href = props.src
  link.download = props.filename
  link.click()
}

function printPdf() {
  const frame = document.getElementById('waiver-pdf-frame') as HTMLIFrameElement | null
  frame?.contentWindow?.focus()
  frame?.contentWindow?.print()
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap gap-2">
      <UButton @click="download">
        Download PDF
      </UButton>
      <UButton
        color="neutral"
        variant="outline"
        @click="printPdf"
      >
        Print
      </UButton>
    </div>
    <iframe
      id="waiver-pdf-frame"
      :src="src"
      title="Waiver PDF"
      class="h-[calc(100dvh-11rem)] min-h-[36rem] w-full rounded-xl border border-stone-200 bg-white"
    />
  </div>
</template>
