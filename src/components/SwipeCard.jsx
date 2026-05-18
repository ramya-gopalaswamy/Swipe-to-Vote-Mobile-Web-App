import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'

import {
  shouldOpenResultsPull,
} from '../lib/pullToResultsGesture.js'

const COMMIT_THRESHOLD = 110

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

export const SwipeCard = forwardRef(function SwipeCard(
  { item, onPersistVote, onVoteEnd, onPullToResults },
  ref,
) {
  const x = useMotionValue(0)
  const leavingRef = useRef(false)
  /** Max downward offset seen during this drag (end-of-frame offset can snap smaller). */
  const pullPeakYRef = useRef(0)
  /** Sum of positive `delta.y` (Chrome sometimes reports cleaner travel than net offset). */
  const pullDownTravelRef = useRef(0)
  /**
   * Raw pointer track (capture) — Framer `drag="x"` often zeros / clips `offset.y` for mouse on
   * Chrome desktop; this mirrors the real cursor path.
   */
  const pullPointerRef = useRef({
    active: false,
    x0: 0,
    y0: 0,
    pointerId: 0,
    maxDy: 0,
    maxAbsDx: 0,
  })
  const surfaceRef = useRef(null)
  const onVoteEndRef = useRef(onVoteEnd)
  const onPersistVoteRef = useRef(onPersistVote)
  const onPullToResultsRef = useRef(onPullToResults)
  const [dragLocked, setDragLocked] = useState(false)

  useEffect(() => {
    onVoteEndRef.current = onVoteEnd
  }, [onVoteEnd])

  useEffect(() => {
    onPersistVoteRef.current = onPersistVote
  }, [onPersistVote])

  useEffect(() => {
    onPullToResultsRef.current = onPullToResults
  }, [onPullToResults])

  const rotate = useTransform(x, [-260, 0, 260], [-16, 0, 16])

  const greenOpacity = useTransform(x, (v) => (v > 0 ? clamp(v / 200, 0, 0.48) : 0))

  const redOpacity = useTransform(x, (v) => (v < 0 ? clamp(Math.abs(v) / 200, 0, 0.48) : 0))

  const stampYesOpacity = useTransform(x, (v) =>
    v > COMMIT_THRESHOLD * 0.45 ? clamp((v - COMMIT_THRESHOLD * 0.45) / 120, 0, 1) : 0,
  )

  const stampNoOpacity = useTransform(x, (v) =>
    v < -COMMIT_THRESHOLD * 0.45
      ? clamp((Math.abs(v) - COMMIT_THRESHOLD * 0.45) / 120, 0, 1)
      : 0,
  )

  const finalize = useCallback(
    async (direction) => {
      if (leavingRef.current) return
      leavingRef.current = true
      setDragLocked(true)

      const choice = direction === 'yes' ? 'yes' : 'no'

      let lastVoteInserted = false

      if (onPersistVoteRef.current) {
        try {
          const outcome = await onPersistVoteRef.current(choice)
          lastVoteInserted = outcome?.status === 'inserted'
        } catch {
          leavingRef.current = false
          setDragLocked(false)
          await animate(x, 0, { type: 'spring', stiffness: 520, damping: 42 })
          return
        }
      }

      const target = direction === 'yes' ? 520 : -520

      await animate(x, target, {
        type: 'spring',
        stiffness: 400,
        damping: 44,
        mass: 0.9,
      })

      onVoteEndRef.current?.({
        itemId: item.id,
        lastVoteInserted,
      })
    },
    [item.id, x],
  )

  useImperativeHandle(
    ref,
    () => ({
      swipeYes: () => finalize('yes'),
      swipeNo: () => finalize('no'),
    }),
    [finalize],
  )

  const handleDragStart = useCallback(() => {
    pullPeakYRef.current = 0
    pullDownTravelRef.current = 0
  }, [])

  const handlePointerDownCapture = useCallback((e) => {
    if (e.button !== 0 || leavingRef.current) {
      return
    }
    if (e.target instanceof Element && e.target.closest('button, a[href]')) {
      return
    }
    const p = pullPointerRef.current
    p.active = true
    p.x0 = e.clientX
    p.y0 = e.clientY
    p.pointerId = e.pointerId
    p.maxDy = 0
    p.maxAbsDx = 0
  }, [])

  const handlePointerMoveCapture = useCallback((e) => {
    const p = pullPointerRef.current
    if (!p.active || e.pointerId !== p.pointerId) {
      return
    }
    const dx = e.clientX - p.x0
    const dy = e.clientY - p.y0
    if (dy > p.maxDy) {
      p.maxDy = dy
    }
    const ax = Math.abs(dx)
    if (ax > p.maxAbsDx) {
      p.maxAbsDx = ax
    }
  }, [])

  const handlePointerUpCapture = useCallback(() => {
    pullPointerRef.current.active = false
  }, [])

  const handleDrag = useCallback((_, info) => {
    if (info.offset.y > pullPeakYRef.current) {
      pullPeakYRef.current = info.offset.y
    }
    if (info.delta.y > 0) {
      pullDownTravelRef.current += info.delta.y
    }
  }, [])

  const handleDragEnd = useCallback(
    (_, info) => {
      if (leavingRef.current) return

      const px = pullPointerRef.current
      const nativeDy = Math.max(px.maxDy, 0)
      const absDx = Math.max(Math.abs(info.offset.x), px.maxAbsDx)
      const dyNet = Math.max(info.offset.y, pullPeakYRef.current, nativeDy)

      const wantsResults =
        onPullToResultsRef.current &&
        shouldOpenResultsPull({
          dx: absDx,
          dy: dyNet,
          dyTravel: Math.max(pullDownTravelRef.current, nativeDy),
          velocityY: info.velocity.y,
          commitThreshold: COMMIT_THRESHOLD,
        })

      if (wantsResults) {
        onPullToResultsRef.current()
        void animate(x, 0, { type: 'spring', stiffness: 480, damping: 40 })
        return
      }

      if (info.offset.x > COMMIT_THRESHOLD) finalize('yes')
      else if (info.offset.x < -COMMIT_THRESHOLD) finalize('no')
      else animate(x, 0, { type: 'spring', stiffness: 480, damping: 40 })
    },
    [finalize, x],
  )

  useEffect(() => {
    leavingRef.current = false
    setDragLocked(false)
    x.jump(0)
  }, [item.id, x])

  /** Desktop Chrome: mouse-drag vertical often under-reported by Framer; wheel down is the natural “pull”. */
  useLayoutEffect(() => {
    const el = surfaceRef.current
    if (!el) {
      return undefined
    }

    const wheel = (e) => {
      if (leavingRef.current || !onPullToResultsRef.current) {
        return
      }
      if (e.deltaY > 72) {
        e.preventDefault()
        onPullToResultsRef.current()
        void animate(x, 0, { type: 'spring', stiffness: 480, damping: 40 })
      }
    }

    el.addEventListener('wheel', wheel, { passive: false })
    return () => el.removeEventListener('wheel', wheel)
  }, [item.id, x])

  const initials = useMemo(() => item.title.slice(0, 1), [item.title])

  return (
    <motion.div
      ref={surfaceRef}
      aria-label={`Swipe card: ${item.title}`}
      className="flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden rounded-[24px] border border-white/[0.09] bg-[#0f0d12] shadow-gala-lg sm:rounded-[28px]"
      style={{ x, rotate, touchAction: 'none' }}
      drag={dragLocked ? false : 'x'}
      dragConstraints={{ left: -260, right: 260 }}
      dragElastic={0.05}
      onPointerDownCapture={handlePointerDownCapture}
      onPointerMoveCapture={handlePointerMoveCapture}
      onPointerUpCapture={handlePointerUpCapture}
      onPointerCancelCapture={handlePointerUpCapture}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
    >
      {/* Text panel — brand + outfit title (label) */}
      <div className="shrink-0 select-none border-b border-white/[0.08] bg-gradient-to-b from-black/90 via-[#14111a] to-[#101018] px-3 pb-2 pt-2 sm:px-5 sm:pb-3 sm:pt-4">
        <p className="text-[9px] font-semibold uppercase tracking-[0.4em] text-gala-gold sm:text-[10px] sm:tracking-[0.42em]">
          Maison Met
        </p>
        <h3 className="mt-1 font-display text-[1.1rem] leading-[1.18] tracking-[-0.02em] text-gala-cream sm:mt-1.5 sm:text-[1.35rem] sm:leading-[1.2] md:text-[1.5rem]">
          {item.title}
        </h3>
      </div>

      {/* Image fills remaining card height; top-weighted crop for full outfit */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <img
          src={item.imageUrl}
          alt=""
          draggable={false}
          className="h-full w-full select-none object-cover object-top"
          decoding="async"
          loading="eager"
        />

        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent sm:h-24" />

        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-emerald-400/90 mix-blend-soft-light"
          style={{ opacity: greenOpacity }}
        />

        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-rose-600/90 mix-blend-multiply"
          style={{ opacity: redOpacity }}
        />

        <motion.span
          aria-hidden
          className="pointer-events-none absolute left-5 top-6 z-[2] max-w-[85%] rotate-[-11deg] rounded-xl border-[3px] border-white/95 bg-black/30 px-2.5 py-1.5 font-display text-sm font-semibold uppercase tracking-[0.35em] text-white shadow-lg backdrop-blur-sm sm:left-6 sm:top-8 sm:px-3 sm:py-2 sm:text-base md:left-8 md:text-lg"
          style={{ opacity: stampYesOpacity }}
        >
          Gala yes
        </motion.span>
        <motion.span
          aria-hidden
          className="pointer-events-none absolute right-5 top-6 z-[2] max-w-[85%] rotate-[11deg] rounded-xl border-[3px] border-white/95 bg-black/30 px-2.5 py-1.5 font-display text-sm font-semibold uppercase tracking-[0.3em] text-white shadow-lg backdrop-blur-sm sm:right-6 sm:top-8 sm:px-3 sm:py-2 sm:text-base md:right-8 md:text-lg"
          style={{ opacity: stampNoOpacity }}
        >
          Gala no
        </motion.span>

        <div className="absolute left-3 top-3 z-[2] flex h-10 w-10 items-center justify-center rounded-full border border-white/25 bg-black/55 text-base font-semibold text-gala-cream shadow-md ring-1 ring-white/10 backdrop-blur-sm sm:left-4 sm:top-4 sm:h-11 sm:w-11 sm:text-lg">
          {initials}
        </div>
      </div>

      <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-white/[0.08] bg-black/75 px-3 py-2.5 text-[10px] font-semibold uppercase tracking-[0.36em] text-white/[0.46] sm:gap-4 sm:px-5 sm:py-3.5">
        <span className="min-w-0 flex-1 text-left leading-snug">
          <span className="text-white/[0.58]">←</span> No
        </span>
        <span className="min-w-0 flex-1 text-right leading-snug">
          Yes <span className="text-white/[0.58]">→</span>
        </span>
      </footer>
    </motion.div>
  )
})

SwipeCard.displayName = 'SwipeCard'
