<script setup lang="ts">
import { publicNavItems } from '~/utils/navigation'

const mobileOpen = ref(false)
const searchOpen = ref(false)
const search = ref('')
const router = useRouter()
const { isAuthenticated, homePath, logout, profile } = useAuth()
const visibleNavItems = computed(() =>
  publicNavItems.filter(item => item.enabled && item.to && (!item.authRequired || isAuthenticated.value)),
)

watch(() => mobileOpen.value, (isOpen) => {
  if (import.meta.client) {
    document.body.style.overflow = isOpen ? 'hidden' : ''
  }
})

async function handleLogout() {
  mobileOpen.value = false
  await logout()
}

function submitSearch() {
  const query = search.value.trim()
  searchOpen.value = false
  mobileOpen.value = false
  router.push(query ? { path: '/products', query: { search: query } } : '/products')
}
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-[#12201a]/6 bg-white">
    <div class="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:h-[72px] sm:gap-4 sm:px-6 lg:px-8">
      <AppLogo />

      <nav
        class="hidden items-center gap-7 lg:flex"
        aria-label="Primary"
      >
        <NuxtLink
          v-for="item in visibleNavItems"
          :key="item.label"
          :to="item.to"
          class="text-sm font-medium text-[#3b4a44] hover:text-[#12201a]"
        >
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="hidden items-center gap-2 lg:flex">
        <UPopover v-model:open="searchOpen">
          <UButton
            color="neutral"
            variant="ghost"
            square
            aria-label="Search equipment"
          >
            <UIcon
              name="i-lucide-search"
              class="size-5"
            />
          </UButton>
          <template #content>
            <form
              class="w-72 p-3"
              @submit.prevent="submitSearch"
            >
              <label class="sr-only" for="header-search">
                Search equipment
              </label>
              <UInput
                id="header-search"
                v-model="search"
                placeholder="Search cameras, drones..."
                autofocus
              />
            </form>
          </template>
        </UPopover>

        <template v-if="isAuthenticated">
          <UButton
            :to="homePath"
            color="neutral"
            variant="outline"
            class="rounded-full"
          >
            {{ profile?.firstName || 'Account' }}
          </UButton>
          <UButton
            color="neutral"
            class="rounded-full"
            @click="handleLogout"
          >
            Sign out
          </UButton>
        </template>
        <template v-else>
          <UButton
            to="/login"
            color="neutral"
            variant="outline"
            class="rounded-full"
          >
            Sign in
          </UButton>
          <UButton
            to="/register"
            color="neutral"
            class="rounded-full"
          >
            Create Account
          </UButton>
        </template>
      </div>

      <UButton
        class="lg:hidden"
        color="neutral"
        variant="ghost"
        square
        :aria-expanded="mobileOpen"
        aria-controls="mobile-nav"
        aria-label="Open menu"
        @click="mobileOpen = true"
      >
        <UIcon
          name="i-lucide-menu"
          class="size-5"
        />
      </UButton>
    </div>

    <USlideover
      v-model:open="mobileOpen"
      title="Menu"
    >
      <template #body>
        <nav
          id="mobile-nav"
          class="flex flex-col gap-4"
          aria-label="Mobile"
        >
          <form @submit.prevent="submitSearch">
            <UInput
              v-model="search"
              placeholder="Search equipment"
            />
          </form>
          <NuxtLink
            v-for="item in visibleNavItems"
            :key="item.label"
            :to="item.to"
            class="text-base text-[#12201a]"
            @click="mobileOpen = false"
          >
            {{ item.label }}
          </NuxtLink>
          <template v-if="isAuthenticated">
            <NuxtLink
              :to="homePath"
              class="text-base text-[#12201a]"
              @click="mobileOpen = false"
            >
              Account
            </NuxtLink>
            <UButton
              color="neutral"
              variant="outline"
              block
              @click="handleLogout"
            >
              Sign out
            </UButton>
          </template>
          <template v-else>
            <UButton
              to="/login"
              color="neutral"
              variant="outline"
              block
              @click="mobileOpen = false"
            >
              Sign in
            </UButton>
            <UButton
              to="/register"
              color="neutral"
              block
              class="rounded-full"
              @click="mobileOpen = false"
            >
              Create Account
            </UButton>
          </template>
        </nav>
      </template>
    </USlideover>
  </header>
</template>
