<script setup lang="ts">
import { FACEBOOK_URL } from '~/utils/constants'

const open = defineModel<boolean>('open', { required: true })

defineProps<{
  bookingCode: string
}>()

const emit = defineEmits<{
  copy: []
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
let stopBurst: (() => void) | null = null

function burstConfetti(target: HTMLCanvasElement) {
  const context = target.getContext('2d')
  if (!context) {
    return () => {}
  }

  const colors = ['#12201a', '#1877f2', '#f5c451', '#e85d4c', '#3d8b6e', '#f7f3ea']
  const pieces = Array.from({ length: 96 }, () => ({
    x: window.innerWidth * (0.2 + Math.random() * 0.6),
    y: window.innerHeight * 0.32,
    vx: (Math.random() - 0.5) * 16,
    vy: -7 - Math.random() * 11,
    size: 6 + Math.random() * 7,
    color: colors[Math.floor(Math.random() * colors.length)] ?? '#12201a',
    spin: (Math.random() - 0.5) * 0.35,
    angle: Math.random() * Math.PI,
  }))
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  const resize = () => {
    target.width = Math.floor(window.innerWidth * ratio)
    target.height = Math.floor(window.innerHeight * ratio)
    context.setTransform(ratio, 0, 0, ratio, 0, 0)
  }
  resize()
  let frame = 0
  let raf = 0
  const tick = () => {
    frame += 1
    context.clearRect(0, 0, window.innerWidth, window.innerHeight)
    for (const piece of pieces) {
      piece.vy += 0.28
      piece.x += piece.vx
      piece.y += piece.vy
      piece.vx *= 0.99
      piece.angle += piece.spin
      context.save()
      context.globalAlpha = Math.max(0, 1 - frame / 130)
      context.translate(piece.x, piece.y)
      context.rotate(piece.angle)
      context.fillStyle = piece.color
      context.fillRect(-piece.size / 2, -piece.size / 4, piece.size, piece.size / 2)
      context.restore()
    }
    if (frame < 140) {
      raf = requestAnimationFrame(tick)
      return
    }
    context.clearRect(0, 0, window.innerWidth, window.innerHeight)
  }
  raf = requestAnimationFrame(tick)
  window.addEventListener('resize', resize)
  return () => {
    cancelAnimationFrame(raf)
    window.removeEventListener('resize', resize)
    context.clearRect(0, 0, window.innerWidth, window.innerHeight)
  }
}

async function celebrate() {
  stopBurst?.()
  stopBurst = null
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    return
  }
  await nextTick()
  if (canvas.value) {
    stopBurst = burstConfetti(canvas.value)
  }
}

watch(open, (value) => {
  if (value) {
    void celebrate()
    return
  }
  stopBurst?.()
  stopBurst = null
})

onBeforeUnmount(() => {
  stopBurst?.()
})
</script>

<template>
  <Teleport to="body">
    <canvas
      v-show="open"
      ref="canvas"
      class="pointer-events-none fixed inset-0 z-[80] h-dvh w-full"
      aria-hidden="true"
    />
  </Teleport>
  <UModal
    v-model:open="open"
    title="Message us to confirm your booking"
    description="Your payment is noted. Message our Facebook page so the shop can confirm this booking."
    :ui="{ content: 'sm:max-w-md' }"
  >
    <template #body>
      <div class="space-y-4">
        <p class="text-sm leading-6 text-[#3b4a44]">
          Send us a message on our Facebook page with your booking code
          <span class="font-semibold text-[#12201a]">{{ bookingCode }}</span>
          and a screenshot of your payment.
        </p>
        <div class="flex flex-col gap-2 sm:flex-row">
          <UButton
            :to="FACEBOOK_URL"
            target="_blank"
            rel="noopener noreferrer"
            size="lg"
            icon="i-lucide-facebook"
            class="w-full justify-center rounded-full bg-[#1877f2] hover:bg-[#166fe5] sm:flex-1"
          >
            Message us on Facebook
          </UButton>
          <UButton
            color="neutral"
            variant="outline"
            size="lg"
            icon="i-lucide-copy"
            class="w-full justify-center rounded-full sm:w-auto"
            @click="emit('copy')"
          >
            Copy code
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
