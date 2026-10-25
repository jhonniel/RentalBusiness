<script setup lang="ts">
import type { MaintenanceChatMessage, MaintenanceChatResponse } from '~/types/maintenance'
import { CHAT_MAX_SUGGESTIONS, chatStarterSuggestions } from '~/utils/chat-suggestions'
import { APP_NAME, FACEBOOK_MESSENGER_URL } from '~/utils/constants'

const props = withDefaults(defineProps<{
  variant?: 'panel' | 'float'
  mode?: 'live' | 'maintenance'
}>(), {
  variant: 'panel',
  mode: 'maintenance',
})

const live = computed(() => props.mode === 'live')
const suggestions = ref<string[]>(chatStarterSuggestions(live.value))

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
const slowReply = ref(false)
let slowReplyTimer: ReturnType<typeof setTimeout> | undefined

watch(pending, (value) => {
  clearTimeout(slowReplyTimer)
  slowReply.value = false
  if (value) {
    slowReplyTimer = setTimeout(() => {
      slowReply.value = true
      scrollToEnd()
    }, 3000)
  }
})

onBeforeUnmount(() => clearTimeout(slowReplyTimer))

const siteOrigin = useRequestURL().origin

function messageParts(content: string) {
  return content.split(/(https?:\/\/[^\s]+)/g)
    .filter(Boolean)
    .map((text) => {
      const link = /^https?:\/\//.test(text)
      const href = link ? text.replace(/[.,!?)]+$/, '') : ''
      const internal = link && (href === siteOrigin || href.startsWith(`${siteOrigin}/`))
      return {
        text: link ? href : text,
        href,
        to: internal ? href.slice(siteOrigin.length) || '/' : '',
        trailing: link ? text.slice(href.length) : '',
      }
    })
}

function scrollToEnd() {
  nextTick(() => {
    if (list.value) {
      list.value.scrollTop = list.value.scrollHeight
    }
  })
}

function followAction() {
  if (props.variant === 'float') {
    open.value = false
  }
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
        messages: messages.value.slice(-12).map(message => ({ role: message.role, content: message.content })),
      },
    })
    messages.value.push({
      role: 'assistant',
      content: payload.reply,
      actions: (payload.actions ?? []).filter(action => action.to.startsWith('/') && !action.to.startsWith('//')),
    })
    const next = (payload.suggestions ?? [])
      .filter(item => typeof item === 'string' && item.trim() && item.length <= 120)
      .slice(0, CHAT_MAX_SUGGESTIONS)
    if (next.length) {
      suggestions.value = next
    }
  }
  catch (error) {
    const payload = typeof error === 'object' && error && 'data' in error
      ? (error as { data?: { message?: string } }).data
      : null
    formError.value = payload?.message || 'We could not send that message.'
    messages.value.push({
      role: 'assistant',
      content: `I could not reply just now. Message us on Facebook at ${FACEBOOK_MESSENGER_URL} and we will help as soon as we can.`,
    })
  }
  finally {
    pending.value = false
    scrollToEnd()
  }
}

const isPhone = useMediaQuery('(max-width: 639px)')
const fullScreen = computed(() => props.variant === 'float' && open.value && isPhone.value)
const scrollLock = useScrollLock(import.meta.client ? document.body : null)
const viewport = reactive({ height: 0, top: 0 })

function syncViewport() {
  const visual = window.visualViewport
  viewport.height = visual?.height ?? window.innerHeight
  viewport.top = visual?.offsetTop ?? 0
  scrollToEnd()
}

watch(fullScreen, (value) => {
  scrollLock.value = value
  if (!import.meta.client) {
    return
  }
  const visual = window.visualViewport
  if (value) {
    syncViewport()
    visual?.addEventListener('resize', syncViewport)
    visual?.addEventListener('scroll', syncViewport)
  }
  else {
    visual?.removeEventListener('resize', syncViewport)
    visual?.removeEventListener('scroll', syncViewport)
  }
})

onBeforeUnmount(() => {
  scrollLock.value = false
  window.visualViewport?.removeEventListener('resize', syncViewport)
  window.visualViewport?.removeEventListener('scroll', syncViewport)
})

const panelStyle = computed(() => fullScreen.value && viewport.height
  ? { height: `${viewport.height}px`, top: `${viewport.top}px` }
  : undefined)

const panelClass = computed(() => {
  if (props.variant !== 'float') {
    return 'h-[min(40rem,calc(100dvh-8rem))] min-h-[26rem] w-full rounded-2xl border'
  }
  return fullScreen.value
    ? 'fixed inset-x-0 top-0 h-dvh w-full rounded-none border-0'
    : 'h-[min(42rem,calc(100dvh-6rem))] w-[min(calc(100vw-1.5rem),28rem)] rounded-2xl border'
})
</script>

<template>
  <Teleport
    to="body"
    :disabled="variant !== 'float'"
  >
    <div
      :class="variant === 'float'
        ? 'pointer-events-none fixed right-4 bottom-4 z-[100] flex flex-col items-end gap-3 pb-[env(safe-area-inset-bottom)] pr-[env(safe-area-inset-right)] print:hidden'
        : 'w-full'"
    >
      <Transition
        name="chat-support"
        @after-enter="scrollToEnd"
      >
        <section
          v-if="variant === 'panel' || open"
          class="chat-support-panel pointer-events-auto flex flex-col overflow-hidden border-[#12201a]/10 bg-white text-left shadow-[0_18px_50px_rgb(18_32_26_/_18%)]"
          :class="panelClass"
          :style="panelStyle"
          role="dialog"
          :aria-modal="fullScreen ? 'true' : undefined"
          aria-label="Chat support"
          @keydown.esc="variant === 'float' && (open = false)"
        >
          <header
            class="flex shrink-0 items-center justify-between gap-3 bg-[#12201a] px-4 py-3 text-white"
            :class="fullScreen ? 'pt-[calc(env(safe-area-inset-top)+0.75rem)]' : ''"
          >
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
              class="-mr-1.5 flex size-10 items-center justify-center rounded-full text-white/70 hover:bg-white/10 hover:text-white sm:size-8"
              aria-label="Close chat"
              @click="open = false"
            >
              <UIcon
                :name="fullScreen ? 'i-lucide-chevron-down' : 'i-lucide-x'"
                class="size-5 sm:size-4"
              />
            </button>
          </header>

          <div
            ref="list"
            class="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4"
          >
            <div
              v-for="(item, index) in messages"
              :key="`${item.role}-${index}`"
              class="flex flex-col gap-2"
              :class="item.role === 'user' ? 'items-end' : 'items-start'"
            >
              <p
                class="max-w-[85%] whitespace-pre-line rounded-2xl px-3 py-2 text-sm leading-6"
                :class="item.role === 'user'
                  ? 'bg-[#12201a] text-white'
                  : 'bg-[#f3f5f4] text-[#3b4a44]'"
              >
                <template
                  v-for="(part, partIndex) in messageParts(item.content)"
                  :key="partIndex"
                >
                  <NuxtLink
                    v-if="part.to"
                    :to="part.to"
                    class="font-medium break-all underline underline-offset-2"
                    :class="item.role === 'user' ? 'text-white' : 'text-[#1877f2]'"
                    @click="followAction"
                  >{{ part.text }}</NuxtLink><a
                    v-else-if="part.href"
                    :href="part.href"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="font-medium break-all underline underline-offset-2"
                    :class="item.role === 'user' ? 'text-white' : 'text-[#1877f2]'"
                  >{{ part.text }}</a><template v-else>
                    {{ part.text }}
                  </template>{{ part.trailing }}
                </template>
              </p>
              <div
                v-if="item.actions?.length"
                class="flex max-w-[85%] flex-wrap gap-2"
              >
                <UButton
                  v-for="action in item.actions"
                  :key="action.to"
                  :to="action.to"
                  size="sm"
                  :color="action.kind === 'book' ? 'primary' : 'neutral'"
                  :variant="action.kind === 'book' ? 'solid' : 'outline'"
                  :icon="action.kind === 'book' ? 'i-lucide-calendar-check' : 'i-lucide-arrow-up-right'"
                  class="rounded-full"
                  @click="followAction"
                >
                  {{ action.label }}
                </UButton>
              </div>
            </div>
            <div
              v-if="pending"
              class="chat-typing-bubble flex flex-col items-start gap-1"
              role="status"
              aria-live="polite"
            >
              <span class="inline-flex items-center gap-1 rounded-2xl bg-[#f3f5f4] px-3.5 py-3">
                <span class="chat-typing-dot size-1.5 rounded-full bg-[#5b6b64]" />
                <span class="chat-typing-dot size-1.5 rounded-full bg-[#5b6b64]" />
                <span class="chat-typing-dot size-1.5 rounded-full bg-[#5b6b64]" />
                <span class="sr-only">{{ APP_NAME }} is typing</span>
              </span>
              <span
                v-if="slowReply"
                class="px-1 text-[11px] text-[#5b6b64]"
              >
                Just a moment, getting your answer…
              </span>
            </div>
          </div>

          <div
            class="shrink-0 border-t border-[#12201a]/8 px-3 py-3"
            :class="fullScreen ? 'pb-[calc(env(safe-area-inset-bottom)+0.75rem)]' : ''"
          >
            <div class="-mx-3 mb-3 flex gap-2 overflow-x-auto overscroll-x-contain px-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <a
                :href="FACEBOOK_MESSENGER_URL"
                target="_blank"
                rel="noopener noreferrer"
                class="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-[#1877f2]/30 bg-[#f4f8ff] px-3 py-1.5 text-xs font-medium text-[#1877f2] hover:bg-[#eaf2ff] sm:px-2.5 sm:py-1 sm:text-[11px]"
              >
                <UIcon
                  name="i-lucide-facebook"
                  class="size-3"
                />
                Message us on Facebook
              </a>
              <button
                v-for="suggestion in suggestions"
                :key="suggestion"
                type="button"
                class="shrink-0 whitespace-nowrap rounded-full border border-[#12201a]/10 px-3 py-1.5 text-xs text-[#3b4a44] hover:bg-[#f3f5f4] sm:px-2.5 sm:py-1 sm:text-[11px]"
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
                class="min-w-0 flex-1 rounded-full border border-[#12201a]/12 px-4 py-2.5 text-base text-[#12201a] sm:px-3 sm:py-2 sm:text-sm"
                maxlength="500"
                placeholder="Ask a question"
                enterkeyhint="send"
                autocomplete="off"
                aria-label="Message"
              >
              <UButton
                type="submit"
                :disabled="!canSend"
                :loading="pending"
                icon="i-lucide-send-horizontal"
                class="shrink-0 justify-center rounded-full max-sm:size-11"
                aria-label="Send message"
              >
                <span class="hidden sm:inline">Send</span>
              </UButton>
            </form>
          </div>
        </section>
      </Transition>

      <button
        v-if="variant === 'float'"
        type="button"
        class="chat-support-launcher pointer-events-auto flex size-14 items-center justify-center rounded-full bg-[#12201a] text-white shadow-[0_12px_30px_rgb(18_32_26_/_32%)]"
        :class="[open ? 'chat-support-launcher-open' : '', fullScreen ? 'hidden' : '']"
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
