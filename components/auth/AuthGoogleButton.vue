<script setup lang="ts">
defineProps<{
  pending?: boolean
  label?: string
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button
    type="button"
    class="inline-flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-[#12201a]/12 bg-white text-sm font-medium text-[#12201a] transition hover:border-[#12201a]/25 hover:bg-[#f7f8f6] disabled:cursor-not-allowed disabled:opacity-60"
    :disabled="pending"
    @click="emit('click')"
  >
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 48 48"
      class="size-5"
      aria-hidden="true"
    >
      <path
        fill="#FFC107"
        d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.2-.1-2.3-.4-3.5Z"
      />
      <path
        fill="#FF3D00"
        d="M6.3 14.7 13 19.6C14.8 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3.1l5.7-5.7C34.2 6.1 29.4 4 24 4 16.3 4 9.6 8.3 6.3 14.7Z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 10-2 13.6-5.2l-6.3-5.3C29.2 35.2 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.6 5.1C9.5 39.6 16.2 44 24 44Z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.5H42V20H24v8h11.3c-1.1 3.2-3.5 5.7-6.6 7.2l6.3 5.3C38.5 37.6 44 31.7 44 24c0-1.2-.1-2.3-.4-3.5Z"
      />
    </svg>
    {{ pending ? 'Redirecting to Google…' : (label || 'Continue with Google') }}
  </button>
</template>
