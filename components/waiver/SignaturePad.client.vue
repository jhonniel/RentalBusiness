<script setup lang="ts">
const canvasRef = ref<HTMLCanvasElement | null>(null)
const hasInk = ref(false)
let drawing = false
let last: { x: number, y: number } | null = null

function context() {
  return canvasRef.value?.getContext('2d') ?? null
}

function point(event: PointerEvent) {
  const canvas = canvasRef.value
  if (!canvas) {
    return { x: 0, y: 0 }
  }

  const rect = canvas.getBoundingClientRect()
  const scaleX = canvas.width / rect.width
  const scaleY = canvas.height / rect.height
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  }
}

function resize() {
  const canvas = canvasRef.value
  const ctx = context()
  if (!canvas || !ctx) {
    return
  }

  const ratio = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  canvas.width = Math.floor(width * ratio)
  canvas.height = Math.floor(height * ratio)
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#1c1917'
  ctx.lineWidth = 2.25 * ratio
  hasInk.value = false
}

function onPointerDown(event: PointerEvent) {
  drawing = true
  last = point(event)
  canvasRef.value?.setPointerCapture(event.pointerId)
}

function onPointerMove(event: PointerEvent) {
  if (!drawing || !last) {
    return
  }

  const ctx = context()
  if (!ctx) {
    return
  }

  const next = point(event)
  ctx.beginPath()
  ctx.moveTo(last.x, last.y)
  ctx.lineTo(next.x, next.y)
  ctx.stroke()
  last = next
  hasInk.value = true
}

function onPointerUp() {
  drawing = false
  last = null
}

function clear() {
  const canvas = canvasRef.value
  const ctx = context()
  if (!canvas || !ctx) {
    return
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height)
  hasInk.value = false
}

function toDataUrl() {
  return canvasRef.value?.toDataURL('image/png') ?? ''
}

onMounted(() => {
  resize()
  window.addEventListener('resize', resize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
})

defineExpose({
  clear,
  hasInk,
  toDataUrl,
})
</script>

<template>
  <div>
    <canvas
      ref="canvasRef"
      class="h-40 w-full cursor-crosshair touch-none rounded-xl border border-stone-300 bg-stone-50"
      aria-label="Signature pad"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @pointerleave="onPointerUp"
    />
    <div class="mt-2 flex items-center justify-between">
      <p class="text-xs text-stone-500">
        {{ hasInk ? 'Signature captured.' : 'Draw your signature above.' }}
      </p>
      <UButton
        type="button"
        color="neutral"
        variant="ghost"
        size="xs"
        @click="clear"
      >
        Clear
      </UButton>
    </div>
  </div>
</template>
