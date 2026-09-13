<script setup lang="ts">
const props = withDefaults(defineProps<{
  id: string
  label: string
  error?: string
  type?: string
  modelValue: string
  autocomplete?: string
  placeholder?: string
  disabled?: boolean
  name?: string
  icon?: string
}>(), {
  type: 'text',
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const reveal = ref(false)
const isSecret = computed(() => props.type === 'password')
const inputType = computed(() => (isSecret.value && reveal.value ? 'text' : props.type))

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLInputElement).value)
}
</script>

<template>
  <div>
    <label
      :for="id"
      class="mb-2 block text-sm font-medium text-[#12201a]"
    >
      {{ label }}
    </label>
    <div
      class="auth-control"
      :class="{ 'auth-control-error': error }"
    >
      <span
        v-if="icon"
        class="flex w-10 shrink-0 items-center justify-center text-[#6b7a74]"
        aria-hidden="true"
      >
        <UIcon
          :name="icon"
          class="size-4"
        />
      </span>
      <input
        :id="id"
        :value="modelValue"
        :type="inputType"
        :name="name || id"
        :autocomplete="autocomplete"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-invalid="Boolean(error)"
        :aria-describedby="error ? `${id}-error` : undefined"
        class="auth-control-field"
        @input="onInput"
      >
      <button
        v-if="isSecret"
        type="button"
        class="flex w-10 shrink-0 items-center justify-center text-[#6b7a74] hover:text-[#12201a]"
        :aria-label="reveal ? 'Hide password' : 'Show password'"
        :disabled="disabled"
        @click="reveal = !reveal"
      >
        <UIcon
          :name="reveal ? 'i-lucide-eye-off' : 'i-lucide-eye'"
          class="size-4"
        />
      </button>
    </div>
    <p
      v-if="error"
      :id="`${id}-error`"
      class="mt-1.5 text-xs text-red-700"
    >
      {{ error }}
    </p>
  </div>
</template>
