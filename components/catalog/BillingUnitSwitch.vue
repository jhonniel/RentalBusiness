<script setup lang="ts">
const billing = defineModel<'day' | 'hour'>({ required: true })

const props = withDefaults(defineProps<{
  tone?: 'storefront' | 'admin'
}>(), {
  tone: 'storefront',
})

const trackClass = computed(() => props.tone === 'admin'
  ? 'rounded-xl bg-stone-100'
  : 'rounded-full bg-white')
const pillClass = computed(() => props.tone === 'admin'
  ? 'rounded-lg bg-white shadow-sm'
  : 'rounded-full bg-[#12201a]')

function optionClass(active: boolean) {
  if (props.tone === 'admin') {
    return active ? 'text-stone-900' : 'text-stone-500'
  }
  return active ? 'text-white' : 'text-[#5b6b64]'
}
</script>

<template>
  <div
    class="relative grid grid-cols-2 p-1 text-sm"
    :class="trackClass"
    role="tablist"
    aria-label="Rental length"
  >
    <span
      class="pointer-events-none absolute top-1 bottom-1 left-1 w-[calc(50%-0.25rem)] motion-safe:transition-[translate] motion-safe:duration-300 motion-safe:ease-out"
      :class="[pillClass, billing === 'hour' ? 'translate-x-full' : 'translate-x-0']"
      aria-hidden="true"
    />
    <button
      type="button"
      role="tab"
      class="relative z-10 min-h-11 rounded-full px-2 font-medium motion-safe:transition-colors motion-safe:duration-300"
      :class="optionClass(billing === 'day')"
      :aria-selected="billing === 'day'"
      @click="billing = 'day'"
    >
      By the day
    </button>
    <button
      type="button"
      role="tab"
      class="relative z-10 min-h-11 rounded-full px-2 font-medium motion-safe:transition-colors motion-safe:duration-300"
      :class="optionClass(billing === 'hour')"
      :aria-selected="billing === 'hour'"
      @click="billing = 'hour'"
    >
      By the hour
    </button>
  </div>
</template>
