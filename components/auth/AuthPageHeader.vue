<script setup lang="ts">
defineProps<{
  eyebrow?: string
  title: string
  description: string
}>()
</script>

<template>
  <div>
    <p class="text-xs font-semibold uppercase tracking-[0.18em] text-[#5b6b64]">
      {{ eyebrow || 'JRY Rentals' }}
    </p>
    <h1 class="font-display mt-3 text-3xl tracking-tight text-[#12201a]">
      {{ title }}
    </h1>
    <p class="mt-2 text-sm leading-6 text-[#5b6b64]">
      {{ description }}
    </p>
  </div>
</template>
