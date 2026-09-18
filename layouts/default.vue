<template>
  <div class="storefront-shell flex min-h-dvh flex-col text-[#12201a]">
    <SkipToContent />
    <PublicHeader />
    <main
      id="main-content"
      class="min-w-0 flex-1"
    >
      <slot />
    </main>
    <PublicFooter />
  </div>
</template>
