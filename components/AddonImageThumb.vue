<script setup lang="ts">
const props = defineProps<{
  name: string
  imageUrl: string | null | undefined
  size?: 'sm' | 'md'
}>()

const open = ref(false)
const sizeClass = computed(() => props.size === 'md' ? 'size-10' : 'size-8')
</script>

<template>
  <span
    v-if="imageUrl"
    class="inline-flex shrink-0"
  >
    <button
      type="button"
      class="overflow-hidden rounded-md border border-stone-200 bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-lumen-600"
      :class="sizeClass"
      :aria-label="`View ${name} image`"
      @click.stop.prevent="open = true"
    >
      <img
        :src="imageUrl"
        :alt="name"
        class="size-full object-cover"
        loading="lazy"
      >
    </button>

    <UModal
      v-model:open="open"
      :title="name"
      :ui="{ content: 'sm:max-w-lg' }"
    >
      <template #body>
        <img
          :src="imageUrl"
          :alt="name"
          class="mx-auto max-h-[70vh] w-full rounded-lg object-contain"
        >
      </template>
    </UModal>
  </span>
</template>
