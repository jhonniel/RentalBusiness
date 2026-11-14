<script setup lang="ts">
type TileSize = 'stat' | 'third' | 'half' | 'wide' | 'full' | 'hero'
type TileTone = 'default' | 'dark' | 'accent' | 'warn'

const props = withDefaults(defineProps<{
  size?: TileSize
  tone?: TileTone
  title?: string
  description?: string
  icon?: string
  to?: string
  linkLabel?: string
}>(), {
  size: 'half',
  tone: 'default',
  title: undefined,
  description: undefined,
  icon: undefined,
  to: undefined,
  linkLabel: 'View all',
})

const SIZES: Record<TileSize, string> = {
  stat: 'col-span-1',
  third: 'col-span-2 lg:col-span-2 xl:col-span-2',
  half: 'col-span-2 lg:col-span-2 xl:col-span-3',
  wide: 'col-span-2 lg:col-span-4 xl:col-span-4',
  full: 'col-span-2 lg:col-span-4 xl:col-span-6',
  hero: 'col-span-2 lg:col-span-2 xl:col-span-2 lg:row-span-2',
}

const TONES: Record<TileTone, string> = {
  default: 'border-stone-200 bg-white text-stone-900',
  dark: 'border-transparent bg-[#12201a] text-white',
  accent: 'border-lumen-100 bg-lumen-50 text-stone-900',
  warn: 'border-amber-200 bg-amber-50 text-stone-900',
}

const muted = computed(() => props.tone === 'dark' ? 'text-white/60' : 'text-stone-500')
</script>

<template>
  <section
    class="flex min-w-0 flex-col rounded-2xl border p-4 sm:p-5"
    :class="[SIZES[size], TONES[tone]]"
  >
    <header
      v-if="title || $slots.action || to"
      class="mb-3 flex items-start justify-between gap-3"
    >
      <div class="min-w-0">
        <h3
          v-if="title"
          class="flex items-center gap-2 text-sm font-semibold"
        >
          <UIcon
            v-if="icon"
            :name="icon"
            class="size-4 shrink-0"
            :class="muted"
          />
          <span class="min-w-0 truncate">{{ title }}</span>
        </h3>
        <p
          v-if="description"
          class="mt-1 text-xs leading-5"
          :class="muted"
        >
          {{ description }}
        </p>
      </div>
      <slot name="action">
        <NuxtLink
          v-if="to"
          :to="to"
          class="inline-flex shrink-0 items-center gap-1 text-xs font-medium max-sm:min-h-11"
          :class="tone === 'dark' ? 'text-white/80 hover:text-white' : 'text-lumen-700 hover:text-lumen-800'"
        >
          {{ linkLabel }}
          <UIcon
            name="i-lucide-arrow-right"
            class="size-3.5"
          />
        </NuxtLink>
      </slot>
    </header>
    <div class="min-w-0 flex-1">
      <slot />
    </div>
  </section>
</template>
