"use client"

import * as React from "react"

const PHONE = "(max-width: 639px)"
// Past a quarter of the sheet, or a quick flick, lets it go.
const DISTANCE = 0.25
const VELOCITY = 0.5 // px per ms

/** Form fields keep their own touch gestures (text selection, sliders). */
function isField(target: EventTarget | null) {
  return target instanceof HTMLElement && target.closest("input, textarea, select, [contenteditable]") !== null
}

/**
 * iOS-style pull-down-to-dismiss for a bottom sheet on phones. Pulling down while the
 * sheet is scrolled to the top drags it with the finger and fades the backdrop; letting
 * go far or fast enough slides it away and calls `onDismiss`, otherwise it springs back.
 * The element gets `data-swiped` so its CSS close animation doesn't play a second time.
 */
export function useSwipeDismiss<T extends HTMLElement>(onDismiss: () => void) {
  // A callback ref: dialog content mounts inside a portal after the first render.
  const [el, setEl] = React.useState<T | null>(null)
  const dismiss = React.useRef(onDismiss)
  React.useEffect(() => {
    dismiss.current = onDismiss
  })

  React.useEffect(() => {
    if (!el || !window.matchMedia(PHONE).matches) return
    const backdrop = () => {
      const prev = el.previousElementSibling
      return prev instanceof HTMLElement && prev.dataset.slot?.endsWith("overlay") ? prev : null
    }

    let startY: number | null = null
    let startT = 0
    let dy = 0
    let dragging = false

    const reset = () => {
      startY = null
      dragging = false
      dy = 0
    }

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1 || isField(e.target) || el.scrollTop > 0) return
      startY = e.touches[0].clientY
      startT = performance.now()
    }

    const onMove = (e: TouchEvent) => {
      if (startY === null) return
      const d = e.touches[0].clientY - startY
      if (!dragging) {
        // Scrolling up, or the sheet scrolled in the meantime: leave it to the browser.
        if (d < -4 || el.scrollTop > 0) return reset()
        if (d < 6) return
        dragging = true
        el.style.transition = "none"
        el.style.animation = "none"
        startY += 6
        startT = performance.now()
      }
      e.preventDefault()
      dy = Math.max(0, e.touches[0].clientY - startY)
      el.style.transform = `translate3d(0, ${dy}px, 0)`
      const b = backdrop()
      if (b) {
        b.style.animation = "none"
        b.style.opacity = String(1 - Math.min(1, dy / el.offsetHeight))
      }
    }

    const onEnd = () => {
      if (!dragging) return reset()
      const velocity = dy / Math.max(1, performance.now() - startT)
      const gone = dy > el.offsetHeight * DISTANCE || velocity > VELOCITY
      const b = backdrop()
      const ease = "var(--ease-ios)"
      if (gone) {
        el.style.transition = `transform 280ms ${ease}`
        el.style.transform = "translate3d(0, 100%, 0)"
        if (b) {
          b.style.transition = `opacity 280ms ${ease}`
          b.style.opacity = "0"
        }
        el.dataset.swiped = ""
        window.setTimeout(() => dismiss.current(), 260)
      } else {
        el.style.transition = `transform 420ms var(--ease-spring)`
        el.style.transform = ""
        if (b) {
          b.style.transition = `opacity 300ms ${ease}`
          b.style.opacity = ""
        }
      }
      reset()
    }

    el.addEventListener("touchstart", onStart, { passive: true })
    // Not passive: once the sheet is being dragged, the page mustn't scroll as well.
    el.addEventListener("touchmove", onMove, { passive: false })
    el.addEventListener("touchend", onEnd)
    el.addEventListener("touchcancel", onEnd)
    return () => {
      // A route kept alive in a hidden <Activity> can come back: don't let it return
      // still swiped off screen.
      el.style.transition = el.style.transform = el.style.animation = ""
      delete el.dataset.swiped
      const b = backdrop()
      if (b) b.style.transition = b.style.opacity = b.style.animation = ""
      el.removeEventListener("touchstart", onStart)
      el.removeEventListener("touchmove", onMove)
      el.removeEventListener("touchend", onEnd)
      el.removeEventListener("touchcancel", onEnd)
    }
  }, [el])

  return setEl
}

/** The little pill at the top of a bottom sheet that says "you can pull this down". */
export function Grabber({ className }: { className?: string }) {
  return (
    <div aria-hidden className={className}>
      <span className="block h-[5px] w-9 rounded-full bg-foreground/20" />
    </div>
  )
}
