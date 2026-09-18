<script setup lang="ts">
import type { MaintenanceChatMessage, MaintenanceChatResponse } from '~/types/maintenance'
import { APP_NAME, BUSINESS_EMAIL } from '~/utils/constants'

const props = withDefaults(defineProps<{
  variant?: 'panel' | 'float'
  mode?: 'live' | 'maintenance'
}>(), {
  variant: 'panel',
  mode: 'maintenance',
})

const live = computed(() => props.mode === 'live')
const suggestions = computed(() => live.value
  ? ['How much is Starlink from Sept 20 to 22?', 'Is the Air 3 free tomorrow?', 'How much is the Osmo for 3 days?', 'How do I book?']
  : ['When will the site be back?', 'How much is Starlink from Sept 20 to 22?', 'Is the drone free tomorrow?', 'Where are you located?'])

const messages = ref<MaintenanceChatMessage[]>([{
  role: 'assistant',
  content: live.value
    ? `Hi — I'm the ${APP_NAME} assistant. Ask about gear, booking, payments, or pickup in Davao City.`
    : `Hi — I'm the ${APP_NAME} assistant. The website is in maintenance, but I can still answer questions about gear, booking, and how to reach us.`,
}])
const draft = ref('')
const pending = ref(false)
const formError = ref('')
const list = ref<HTMLElement | null>(null)
const open = ref(props.variant === 'panel')

const canSend = computed(() => Boolean(draft.value.trim()) && !pending.value)

function scrollToEnd() {
  nextTick(() => {
    if (list.value) {
      list.value.scrollTop = list.value.scrollHeight
    }
  })
}

function toggleOpen() {
  open.value = !open.value
  if (open.value) {
    scrollToEnd()
  }
}

async function send(text = draft.value) {
  const content = text.trim()
  if (!content || pending.value) {
    return
  }

  open.value = true
  formError.value = ''
  draft.value = ''
  messages.value.push({ role: 'user', content })
  pending.value = true
  scrollToEnd()

  try {
    const payload = await $fetch<MaintenanceChatResponse>('/api/maintenance/chat', {
      method: 'POST',
      body: {
        messages: messages.value.slice(-12),
      },
    })
    messages.value.push({
      role: 'assistant',
      content: payload.reply,
    })
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not send that message.'
    messages.value.push({
      role: 'assistant',
      content: `I could not reply just now. Email ${BUSINESS_EMAIL} and we will help as soon as we can.`,
    })
  }
  finally {
    pending.value = false
    scrollToEnd()
  }
}

const panelClass = computed(() => props.variant === 'float'
  ? 'h-[min(28rem,calc(100dvh-7rem))] w-[min(calc(100vw-1.5rem),22rem)]'
  : 'h-[32rem] w-full')
</script>

<template>
  <Teleport
    to="body"
    :disabled="variant !== 'float'"
  >
    <div
      :class="variant === 'float'
        ? 'pointer-events-none fixed right-4 bottom-4 z-[100] flex flex-col items-end gap-3 pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)]'
        : 'w-full'"
    >
      <Transition
        name="chat-support"
        @after-enter="scrollToEnd"
      >
        <section
          v-if="variant === 'panel' || open"
          class="chat-support-panel pointer-events-auto flex flex-col overflow-hidden rounded-2xl border border-[#12201a]/10 bg-white text-left shadow-[0_18px_50px_rgb(18_32_26_/_18%)]"
          :class="panelClass"
        >
        <header class="flex items-center justify-between gap-3 bg-[#12201a] px-4 py-3 text-white">
          <div>
            <p class="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60">
              Chat support
            </p>
            <h2 class="mt-0.5 text-sm font-semibold">
              {{ APP_NAME }}
            </h2>
          </div>
          <button
            v-if="variant === 'float'"
            type="button"
            class="rounded-full p-1 text-white/70 hover:bg-white/10 hover:text-white"
            aria-label="Close chat"
            @click="open = false"
          >
            <UIcon
              name="i-lucide-x"
              class="size-4"
            />
          </button>
        </header>

        <div
          ref="list"
          class="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4"
        >
          <div
            v-for="(item, index) in messages"
            :key="`${item.role}-${index}`"
            class="flex"
            :class="item.role === 'user' ? 'justify-end' : 'justify-start'"
          >
            <p
              class="max-w-[85%] rounded-2xl px-3 py-2 text-sm leading-6"
              :class="item.role === 'user'
                ? 'bg-[#12201a] text-white'
                : 'bg-[#f3f5f4] text-[#3b4a44]'"
            >
              {{ item.content }}
            </p>
          </div>
          <p
            v-if="pending"
            class="text-xs text-[#5b6b64]"
          >
            Thinking…
          </p>
        </div>

        <div class="border-t border-[#12201a]/8 px-3 py-3">
          <div class="mb-3 flex flex-wrap gap-2">
            <button
              v-for="suggestion in suggestions"
              :key="suggestion"
              type="button"
              class="rounded-full border border-[#12201a]/10 px-2.5 py-1 text-[11px] text-[#3b4a44] hover:bg-[#f3f5f4]"
              :disabled="pending"
              @click="send(suggestion)"
            >
              {{ suggestion }}
            </button>
          </div>
          <p
            v-if="formError"
            class="mb-2 text-xs text-red-700"
          >
            {{ formError }}
          </p>
          <form
            class="flex gap-2"
            method="post"
            @submit.prevent="send()"
          >
            <input
              v-model="draft"
              class="min-w-0 flex-1 rounded-full border border-[#12201a]/12 px-3 py-2 text-sm text-[#12201a]"
              maxlength="500"
              placeholder="Ask a question"
              :disabled="pending"
            >
            <UButton
              type="submit"
              :disabled="!canSend"
              :loading="pending"
            >
              Send
            </UButton>
          </form>
        </div>
        </section>
      </Transition>

      <button
        v-if="variant === 'float'"
        type="button"
        class="chat-support-launcher pointer-events-auto flex size-14 items-center justify-center rounded-full bg-[#12201a] text-white shadow-[0_12px_30px_rgb(18_32_26_/_32%)]"
        :class="open ? 'chat-support-launcher-open' : ''"
        :aria-expanded="open"
        :aria-label="open ? 'Close chat support' : 'Open chat support'"
        @click="toggleOpen"
      >
        <span class="relative size-6">
          <UIcon
            name="i-lucide-message-circle"
            class="chat-support-launcher-icon absolute inset-0 size-6"
            :class="open ? 'chat-support-launcher-icon-hidden' : ''"
          />
          <UIcon
            name="i-lucide-x"
            class="chat-support-launcher-icon absolute inset-0 size-6"
            :class="open ? '' : 'chat-support-launcher-icon-hidden'"
          />
        </span>
      </button>
    </div>
  </Teleport>
</template>
