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

function applyStroke(ctx: CanvasRenderingContext2D, ratio: number) {
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.strokeStyle = '#1c1917'
  ctx.lineWidth = 2.25 * ratio
}

function resize() {
  const canvas = canvasRef.value
  if (!canvas) {
    return
  }

  const ratio = window.devicePixelRatio || 1
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (!width || !height) {
    return
  }

  const nextWidth = Math.floor(width * ratio)
  const nextHeight = Math.floor(height * ratio)
  const ctx = context()
  if (!ctx) {
    return
  }

  if (canvas.width === nextWidth && canvas.height === nextHeight) {
    applyStroke(ctx, ratio)
    return
  }

  const previous = document.createElement('canvas')
  previous.width = canvas.width
  previous.height = canvas.height
  const previousCtx = previous.getContext('2d')
  if (previousCtx && hasInk.value) {
    previousCtx.drawImage(canvas, 0, 0)
  }

  canvas.width = nextWidth
  canvas.height = nextHeight
  const nextCtx = context()
  if (!nextCtx) {
    return
  }
  applyStroke(nextCtx, ratio)
  if (previous.width && previous.height && hasInk.value) {
    nextCtx.drawImage(previous, 0, 0, canvas.width, canvas.height)
  }
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

function hasSignature() {
  return hasInk.value
}

function toDataUrl() {
  const canvas = canvasRef.value
  if (!canvas) {
    return ''
  }

  const exportCanvas = document.createElement('canvas')
  exportCanvas.width = canvas.width
  exportCanvas.height = canvas.height
  const exportCtx = exportCanvas.getContext('2d')
  if (!exportCtx) {
    return canvas.toDataURL('image/png')
  }

  exportCtx.fillStyle = '#ffffff'
  exportCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height)
  exportCtx.drawImage(canvas, 0, 0)
  return exportCanvas.toDataURL('image/png')
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
  hasSignature,
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
