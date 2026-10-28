<script setup lang="ts">
import { FEEDBACK_RATING_LABELS, FEEDBACK_RATING_MAX } from '~/utils/feedback'

const props = withDefaults(defineProps<{
  modelValue?: number
  readOnly?: boolean
  size?: 'sm' | 'md' | 'lg'
  label?: string
}>(), {
  modelValue: 0,
  readOnly: false,
  size: 'md',
  label: 'Rating',
})

const emit = defineEmits<{
  'update:modelValue': [value: number]
}>()

const STAR_PATH = 'M12 2.5l2.94 5.96 6.56.95-4.75 4.63 1.12 6.53L12 17.5l-5.87 3.07 1.12-6.53L2.5 9.41l6.56-.95L12 2.5z'
const hover = ref(0)
const stars = Array.from({ length: FEEDBACK_RATING_MAX }, (_, index) => index + 1)
const shown = computed(() => hover.value || props.modelValue)
const iconSize = computed(() => ({ sm: 'size-4', md: 'size-8', lg: 'size-10' })[props.size])

function filled(star: number) {
  return star <= (props.readOnly ? Math.round(props.modelValue) : shown.value)
}

function choose(value: number) {
  if (!props.readOnly) {
    emit('update:modelValue', value)
  }
}

function onKey(event: KeyboardEvent) {
  if (props.readOnly) {
    return
  }
  if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
    event.preventDefault()
    choose(Math.min(FEEDBACK_RATING_MAX, (props.modelValue || 0) + 1))
  }
  if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
    event.preventDefault()
    choose(Math.max(1, (props.modelValue || 1) - 1))
  }
}
</script>

<template>
  <div
    class="inline-flex items-center gap-0.5"
    :role="readOnly ? 'img' : 'radiogroup'"
    :aria-label="readOnly ? `${label}: ${modelValue} out of ${FEEDBACK_RATING_MAX}` : label"
    @mouseleave="hover = 0"
    @keydown="onKey"
  >
    <template v-if="readOnly">
      <svg
        v-for="star in stars"
        :key="star"
        viewBox="0 0 24 24"
        aria-hidden="true"
        :class="[iconSize, filled(star) ? 'fill-amber-400 stroke-amber-400' : 'fill-transparent stroke-stone-300']"
        stroke-width="1.5"
        stroke-linejoin="round"
      >
        <path :d="STAR_PATH" />
      </svg>
    </template>
    <template v-else>
      <button
        v-for="star in stars"
        :key="star"
        type="button"
        role="radio"
        :aria-checked="modelValue === star"
        :aria-label="`${star} star${star === 1 ? '' : 's'}, ${FEEDBACK_RATING_LABELS[star]}`"
        :tabindex="(modelValue || 1) === star ? 0 : -1"
        class="rounded-md p-0.5 transition-transform duration-150 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 active:scale-95"
        @mouseenter="hover = star"
        @click="choose(star)"
      >
        <svg
          viewBox="0 0 24 24"
          aria-hidden="true"
          :class="[iconSize, filled(star) ? 'fill-amber-400 stroke-amber-400' : 'fill-transparent stroke-stone-300']"
          class="transition-colors duration-150"
          stroke-width="1.5"
          stroke-linejoin="round"
        >
          <path :d="STAR_PATH" />
        </svg>
      </button>
    </template>
  </div>
</template>
