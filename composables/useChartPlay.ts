/** Starts a chart's animation once it is on screen and has a real width, including on a phone. */
export function useChartPlay(target: Ref<HTMLElement | null>) {
  const play = ref(false)
  let played = false
  let frame = 0

  function reduced() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  }

  function begin() {
    cancelAnimationFrame(frame)
    play.value = false
    frame = requestAnimationFrame(() => {
      play.value = true
      played = true
    })
  }

  function waitForSize(tries = 0) {
    const element = target.value
    if (!element) {
      return
    }
    if (element.getBoundingClientRect().width < 8 && tries < 30) {
      frame = requestAnimationFrame(() => waitForSize(tries + 1))
      return
    }
    begin()
  }

  function replay() {
    if (!played || reduced()) {
      return
    }
    waitForSize()
  }

  let observer: IntersectionObserver | null = null

  onMounted(() => {
    if (reduced()) {
      play.value = true
      played = true
      return
    }

    const element = target.value
    if (!element || typeof IntersectionObserver === 'undefined') {
      waitForSize()
      return
    }

    observer = new IntersectionObserver((entries) => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer?.disconnect()
        observer = null
        waitForSize()
      }
    }, { threshold: 0.2 })
    observer.observe(element)
  })

  onUnmounted(() => {
    observer?.disconnect()
    cancelAnimationFrame(frame)
  })

  return { play, replay }
}
