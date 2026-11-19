<script setup lang="ts">
type StatTone = 'default' | 'dark' | 'accent' | 'warn'

withDefaults(defineProps<{
  label: string
  value: string
  hint?: string
  icon?: string
  to?: string
  tone?: StatTone
  wide?: boolean
  valueTone?: 'good' | 'bad' | null
}>(), {
  hint: undefined,
  icon: undefined,
  to: undefined,
  tone: 'default',
  wide: false,
  valueTone: null,
})

const TONES: Record<StatTone, string> = {
  default: 'border-stone-200 bg-white text-stone-900',
  dark: 'border-transparent bg-[#12201a] text-white',
  accent: 'border-lumen-100 bg-lumen-50 text-stone-900',
  warn: 'border-amber-200 bg-amber-50 text-stone-900',
}
</script>

<template>
  <component
    :is="to && !$slots.corner ? resolveComponent('NuxtLink') : 'article'"
    :to="to && !$slots.corner ? to : undefined"
    class="group relative flex min-w-0 flex-col justify-between gap-3 rounded-2xl border p-4 transition-colors sm:p-5"
    :class="[
      TONES[tone],
      wide ? 'col-span-2' : 'col-span-1',
      to ? (tone === 'dark' ? 'hover:bg-[#1a2d25]' : 'hover:border-stone-300') : '',
    ]"
  >
    <NuxtLink
      v-if="to && $slots.corner"
      :to="to"
      class="absolute inset-0 rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
      :class="tone === 'dark' ? 'focus-visible:outline-white' : 'focus-visible:outline-stone-900'"
      :aria-label="label"
    />
    <div
      class="flex items-start justify-between gap-2"
      :class="$slots.corner ? 'relative z-10 pointer-events-none' : ''"
    >
      <p
        class="min-w-0 text-[11px] font-medium uppercase leading-4 tracking-wider"
        :class="tone === 'dark' ? 'text-white/60' : 'text-stone-500'"
      >
        {{ label }}
      </p>
      <div :class="$slots.corner ? 'pointer-events-auto' : ''">
        <slot name="corner">
          <UIcon
            v-if="icon"
            :name="icon"
            class="size-4 shrink-0"
            :class="tone === 'dark' ? 'text-white/60' : 'text-stone-400'"
          />
        </slot>
      </div>
    </div>
    <div
      class="min-w-0"
      :class="$slots.corner ? 'relative z-10 pointer-events-none' : ''"
    >
      <p
        class="truncate font-semibold tabular-nums tracking-tight"
        :class="[wide ? 'text-3xl sm:text-4xl' : 'text-xl sm:text-2xl', valueTone === 'bad' ? 'text-red-600' : valueTone === 'good' ? 'text-emerald-700' : '']"
      >
        <AdminCount :value="value" />
      </p>
      <p
        v-if="hint"
        class="mt-1 text-xs"
        :class="tone === 'dark' ? 'text-white/60' : 'text-stone-500'"
      >
        {{ hint }}
      </p>
    </div>
  </component>
</template>
