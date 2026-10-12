<script setup lang="ts">
import { waiverDisplayLines } from '~/utils/waiver'

const props = defineProps<{
  text: string
}>()

const lines = computed(() => waiverDisplayLines(props.text))
</script>

<template>
  <p class="w-full max-w-full min-w-0 whitespace-pre-wrap break-words [overflow-wrap:anywhere] [word-spacing:normal]">
    <template
      v-for="(line, index) in lines"
      :key="index"
    >
      <br v-if="index > 0">
      <template
        v-for="(part, partIndex) in line"
        :key="partIndex"
      >
        <strong
          v-if="part.bold"
          class="font-semibold text-inherit"
        >{{ part.text }}</strong>
        <template v-else>{{ part.text }}</template>
      </template>
    </template>
  </p>
</template>
