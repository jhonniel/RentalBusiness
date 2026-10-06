<script lang="ts">
const cameraStops = new Set<() => void>()
</script>

<script setup lang="ts">
const props = defineProps<{
  facing: 'user' | 'environment'
  disabled?: boolean
  modelValue: File | null
}>()

const emit = defineEmits<{
  'update:modelValue': [file: File | null]
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const live = ref(false)
const errorMessage = ref('')
const previewUrl = ref('')
let stream: MediaStream | null = null
let session = 0

watch(() => props.modelValue, (file) => {
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
  }
  previewUrl.value = file ? URL.createObjectURL(file) : ''
}, { immediate: true })

onBeforeUnmount(() => {
  stopCamera()
  if (previewUrl.value) {
    URL.revokeObjectURL(previewUrl.value)
    previewUrl.value = ''
  }
})

function claimCamera() {
  for (const stop of [...cameraStops]) {
    if (stop !== stopCamera) {
      stop()
    }
  }
  cameraStops.add(stopCamera)
}

function stopCamera() {
  session += 1
  stream?.getTracks().forEach(track => track.stop())
  stream = null
  if (videoRef.value) {
    videoRef.value.srcObject = null
  }
  live.value = false
  cameraStops.delete(stopCamera)
}

async function openCamera() {
  errorMessage.value = ''
  if (import.meta.server || typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    errorMessage.value = 'This browser cannot open the camera. Use a phone browser and allow camera access.'
    return
  }

  stopCamera()
  const current = ++session
  claimCamera()

  try {
    const next = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: {
        facingMode: { ideal: props.facing },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
    })
    if (current !== session) {
      next.getTracks().forEach(track => track.stop())
      return
    }

    stream = next
    live.value = true
    await nextTick()
    const video = videoRef.value
    if (!video) {
      stopCamera()
      return
    }
    video.srcObject = next
    await video.play()
  }
  catch {
    if (current === session) {
      errorMessage.value = 'Allow camera access to take this photo.'
      stopCamera()
    }
  }
}

async function capture() {
  const video = videoRef.value
  if (!video?.videoWidth) {
    errorMessage.value = 'The camera is still starting. Try again in a moment.'
    return
  }

  const canvas = document.createElement('canvas')
  canvas.width = video.videoWidth
  canvas.height = video.videoHeight
  const context = canvas.getContext('2d')
  if (!context) {
    errorMessage.value = 'We could not take that photo.'
    return
  }

  context.drawImage(video, 0, 0, canvas.width, canvas.height)
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9))
  if (!blob) {
    errorMessage.value = 'We could not take that photo.'
    return
  }

  const name = props.facing === 'user' ? 'selfie.jpg' : 'government-id.jpg'
  emit('update:modelValue', new File([blob], name, { type: 'image/jpeg' }))
  errorMessage.value = ''
  stopCamera()
}

function retake() {
  emit('update:modelValue', null)
  openCamera()
}
</script>

<template>
  <div class="mt-4">
    <img
      v-if="previewUrl && !live"
      :src="previewUrl"
      alt="Captured photo"
      class="aspect-[4/3] w-full rounded-xl bg-stone-100 object-cover"
    >
    <video
      v-show="live"
      ref="videoRef"
      autoplay
      muted
      playsinline
      class="aspect-[4/3] w-full rounded-xl bg-stone-900 object-cover"
      :class="facing === 'user' ? '-scale-x-100' : ''"
    />

    <p
      v-if="errorMessage"
      class="mt-3 text-sm text-red-700"
    >
      {{ errorMessage }}
    </p>

    <div class="mt-3 flex flex-col gap-2 sm:flex-row">
      <UButton
        v-if="live"
        type="button"
        class="w-full sm:w-auto"
        :disabled="disabled"
        @click="capture"
      >
        Capture photo
      </UButton>
      <UButton
        v-else-if="modelValue"
        type="button"
        color="neutral"
        variant="outline"
        class="w-full sm:w-auto"
        :disabled="disabled"
        @click="retake"
      >
        Retake
      </UButton>
      <UButton
        v-else
        type="button"
        class="w-full sm:w-auto"
        :disabled="disabled"
        @click="openCamera"
      >
        Open camera
      </UButton>
      <UButton
        v-if="live"
        type="button"
        color="neutral"
        variant="outline"
        class="w-full sm:w-auto"
        @click="stopCamera"
      >
        Close camera
      </UButton>
    </div>
    <p
      v-if="modelValue && !live"
      class="mt-2 text-xs text-stone-500"
    >
      Photo ready.
    </p>
  </div>
</template>
