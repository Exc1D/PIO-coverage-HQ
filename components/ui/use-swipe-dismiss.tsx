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

function setRef<T>(ref: React.Ref<T> | undefined, node: T | null) {
  if (typeof ref === "function") ref(node)
  else if (ref) ref.current = node
}

/**
 * iOS-style pull-down-to-dismiss for a bottom sheet on phones. Pulling down while the
 * sheet is scrolled to the top drags it with the finger and fades the backdrop. Letting
 * go far or fast enough asks to close (`onDismiss`): if the dialog closes, its CSS close
 * animation carries on from where the finger left it; if it refuses (say, while saving),
 * the sheet springs back. A shorter pull, or a cancelled touch, also springs back.
 *
 * Returns a callback ref; pass the caller's own `ref` as `forwardedRef` to keep it working.
 */
export function useSwipeDismiss<T extends HTMLElement>(onDismiss: () => void, forwardedRef?: React.Ref<T>) {
  // State, not a ref object: dialog content mounts inside a portal after the first render.
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
    // The open animations have no end keyframe, so these inline values show through them
    // and the close animations start from them.
    const clear = () => {
      el.style.transition = el.style.transform = ""
      const b = backdrop()
      if (b) b.style.transition = b.style.opacity = ""
    }
    const springBack = () => {
      el.style.transition = "transform 420ms var(--ease-spring)"
      el.style.transform = ""
      const b = backdrop()
      if (b) {
        b.style.transition = "opacity 300ms var(--ease-ios)"
        b.style.opacity = ""
      }
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
        startY += 6
        startT = performance.now()
      }
      e.preventDefault()
      dy = Math.max(0, e.touches[0].clientY - startY)
      el.style.transform = `translate3d(0, ${dy}px, 0)`
      const b = backdrop()
      if (b) {
        b.style.transition = "none"
        b.style.opacity = String(1 - Math.min(1, dy / el.offsetHeight))
      }
    }

    const onEnd = () => {
      if (!dragging) return reset()
      const velocity = dy / Math.max(1, performance.now() - startT)
      const gone = dy > el.offsetHeight * DISTANCE || velocity > VELOCITY
      reset()
      if (!gone) return springBack()
      dismiss.current()
      // React has re-rendered by the next frame: still open means the close was refused.
      requestAnimationFrame(() => {
        if (el.isConnected && el.dataset.state === "open") springBack()
      })
    }

    // The OS took the touch away (a second finger, an alert): that's not a release.
    const onCancel = () => {
      if (dragging) springBack()
      reset()
    }

    el.addEventListener("touchstart", onStart, { passive: true })
    // Not passive: once the sheet is being dragged, the page mustn't scroll as well.
    el.addEventListener("touchmove", onMove, { passive: false })
    el.addEventListener("touchend", onEnd)
    el.addEventListener("touchcancel", onCancel)
    return () => {
      // A route kept alive in a hidden <Activity> can come back: don't let it return
      // still swiped off screen.
      clear()
      el.removeEventListener("touchstart", onStart)
      el.removeEventListener("touchmove", onMove)
      el.removeEventListener("touchend", onEnd)
      el.removeEventListener("touchcancel", onCancel)
    }
  }, [el])

  return React.useCallback(
    (node: T | null) => {
      setEl(node)
      setRef(forwardedRef, node)
    },
    [forwardedRef]
  )
}

/** The little pill at the top of a bottom sheet that says "you can pull this down". */
export function Grabber({ className }: { className?: string }) {
  return (
    <div aria-hidden className={className}>
      <span className="block h-[5px] w-9 rounded-full bg-foreground/20" />
    </div>
  )
}
