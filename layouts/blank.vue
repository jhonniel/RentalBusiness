<template>
  <div class="flex min-h-dvh flex-col bg-stone-50">
    <SkipToContent />
    <main
      id="main-content"
      class="flex-1"
    >
      <slot />
    </main>
    <NeedHelpBar />
  </div>
</template>
