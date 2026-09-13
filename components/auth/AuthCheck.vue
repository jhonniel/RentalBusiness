<script setup lang="ts">
defineProps<{
  error?: string
  disabled?: boolean
}>()

const model = defineModel<boolean>({ default: false })
</script>

<template>
  <div>
    <label class="flex items-start gap-3 text-sm leading-6 text-[#3b4a44]">
      <input
        v-model="model"
        type="checkbox"
        class="auth-check mt-1"
        :disabled="disabled"
      >
      <span>
        <slot />
      </span>
    </label>
    <p
      v-if="error"
      class="mt-1.5 pl-8 text-xs text-red-700"
    >
      {{ error }}
    </p>
  </div>
</template>
