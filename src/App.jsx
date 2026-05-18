import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { BottomNav } from './components/BottomNav.jsx'
import { MatchesView } from './components/MatchesView.jsx'
import { ResultsView } from './components/ResultsView.jsx'
import { ProfileModal } from './components/ProfileModal.jsx'
import { ProfileIcon } from './components/ProfileIcon.jsx'
import { SignInModal } from './components/SignInModal.jsx'
import { SwipeCard } from './components/SwipeCard.jsx'
import { sampleItems } from './data/sampleItems.js'
import { applyLocalLookImages } from './lib/localLookAssets.js'
import { fetchItems, fetchMyVotes, submitVote, undoVote } from './lib/galaApi.js'
import {
  PULL_RESULTS_DOWN_VS_HORIZONTAL,
  PULL_RESULTS_DY_MIN,
} from './lib/pullToResultsGesture.js'
import {
  clearPersistedSession,
  persistSessionBundle,
  readDisplayName,
  readPersistedSessionId,
} from './lib/sessionIdentity.js'

/** Kept in sync with `MAX_DECISION_TIME_MS` in `server/index.js`. */
const MAX_DECISION_TIME_MS = 600_000

function EndOfDeckScreen({ onViewResults }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 380, damping: 38 }}
      className="flex flex-1 flex-col items-center justify-center gap-8 px-6 pb-8 text-center"
    >
      <div className="space-y-4">
        <p className="gala-eyebrow">Intermission</p>
        <h2 className="gala-screen-title">You’ve voted on every look</h2>
        <p className="gala-lede px-1">
          See how others voted — open Results for live yes/no tallies across the crowd (your session stays
          deduped in SQLite).
        </p>
      </div>
      <button type="button" onClick={onViewResults} className="gala-btn-primary w-full max-w-[320px] tap-highlight-none">
        Open Results tab
      </button>
    </motion.div>
  )
}

function getInitialIdentity() {
  try {
    const id = readPersistedSessionId()

    if (!id) {
      return { sessionId: '', displayName: '', needsSignIn: true }
    }

    return {
      sessionId: id,
      displayName: readDisplayName(),
      needsSignIn: false,
    }
  } catch {
    return { sessionId: '', displayName: '', needsSignIn: true }
  }
}

export default function App() {
  const swipeRef = useRef(null)
  const activeVoteTargetRef = useRef(null)

  const initialIdentity = useMemo(() => getInitialIdentity(), [])

  const [sessionId, setSessionId] = useState(initialIdentity.sessionId)
  const [displayName, setDisplayName] = useState(initialIdentity.displayName)

  const [votesBackendLive, setVotesBackendLive] = useState(false)

  const [deckItems, setDeckItems] = useState([])
  const [deckLoadState, setDeckLoadState] = useState('loading')
  const [deckErrorMessage, setDeckErrorMessage] = useState('')
  const [catalogBanner, setCatalogBanner] = useState('')

  const [persistErrorMessage, setPersistErrorMessage] = useState('')
  const [activeTab, setActiveTab] = useState('swipe')
  const [currentIndex, setCurrentIndex] = useState(0)
  const indexRef = useRef(0)

  useEffect(() => {
    indexRef.current = currentIndex
  }, [currentIndex])

  const [undoSnap, setUndoSnap] = useState(null)

  const [profileOverlayOpen, setProfileOverlayOpen] = useState(false)

  const needsSignIn = !sessionId
  const isReady = !needsSignIn

  const handleSignInComplete = useCallback(({ sessionId: sid, displayName: dn }) => {
    persistSessionBundle(sid, dn ?? sid)
    setSessionId(sid)
    setDisplayName(dn ?? sid)
  }, [])

  const handleSignOutVisitor = useCallback(() => {
    clearPersistedSession()
    setSessionId('')
    setDisplayName('')
    setProfileOverlayOpen(false)
    setCurrentIndex(0)
    setUndoSnap(null)
    setActiveTab('swipe')
  }, [])

  useEffect(() => {
    if (!profileOverlayOpen) {
      return undefined
    }

    function onEscape(e) {
      if (e.key === 'Escape') {
        setProfileOverlayOpen(false)
      }
    }

    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [profileOverlayOpen])

  useEffect(() => {
    let cancelled = false

    async function hydrateDeck() {
      setDeckLoadState('loading')

      try {
        const fetched = await fetchItems()

        if (cancelled) {
          return
        }

        const safeDeck = fetched.length > 0 ? fetched : sampleItems

        setDeckItems([...safeDeck])
        setVotesBackendLive(true)
        setDeckErrorMessage('')
        setCatalogBanner(
          fetched.length === 0 ? 'API returned zero outfits — showing bundled placeholders.' : '',
        )

        setDeckLoadState('ready-online')
      } catch (error) {
        console.error('[GalaSwipe] Unable to hydrate deck', error)

        if (!cancelled) {
          setDeckItems([...sampleItems])
          setVotesBackendLive(false)
          setDeckErrorMessage(error.message ?? 'API unreachable')
          setCatalogBanner(
            'Offline preview — run `npm run dev:full` so Express + SQLite serves `/api/items`.',
          )

          setDeckLoadState('ready-offline')
        }
      }
    }

    hydrateDeck()

    return () => {
      cancelled = true
    }
  }, [])

  const deckReady =
    deckLoadState === 'ready-offline' ||
    deckLoadState === 'ready-online' ||
    deckLoadState === 'degraded'

  /** After reload: jump to first deck card this session hasn’t voted on yet (server is source of truth). */
  useEffect(() => {
    if (
      !sessionId ||
      !deckReady ||
      !votesBackendLive ||
      deckItems.length === 0 ||
      deckLoadState !== 'ready-online'
    ) {
      return undefined
    }

    let cancelled = false

    async function resumeSwipePosition() {
      try {
        const rows = await fetchMyVotes({ sessionId })

        if (cancelled) {
          return
        }

        const votedIds = new Set(rows.map((r) => r.item_id).filter(Boolean))
        let nextIndex = deckItems.findIndex((item) => !votedIds.has(item.id))

        if (nextIndex === -1) {
          nextIndex = deckItems.length
        }

        setCurrentIndex(nextIndex)
      } catch (error) {
        console.warn('[GalaSwipe] Could not resume swipe position from server', error)
      }
    }

    void resumeSwipePosition()

    return () => {
      cancelled = true
    }
  }, [sessionId, deckReady, votesBackendLive, deckItems, deckLoadState])

  const deckHasCards = deckItems.length > 0

  const displayDeck = useMemo(() => applyLocalLookImages(deckItems), [deckItems])
  const sampleDisplayDeck = useMemo(() => applyLocalLookImages(sampleItems), [])

  const lookImageById = useMemo(() => {
    const m = new Map()

    for (const item of displayDeck) {
      m.set(item.id, item.imageUrl)
    }

    return m
  }, [displayDeck])

  const deckFinished = deckReady && deckHasCards && currentIndex >= deckItems.length

  const swipeLayoutTight = isReady && deckReady && activeTab === 'swipe'

  const activeItem = useMemo(() => {
    if (!deckReady || !deckHasCards || deckFinished) {
      return null
    }

    return displayDeck[currentIndex] ?? null
  }, [currentIndex, deckFinished, deckHasCards, displayDeck, deckReady])

  /** Wall-clock ms when the current card became active (for analytics decision time). */
  const cardShownAtRef = useRef(0)

  useEffect(() => {
    if (!activeItem?.id) {
      return
    }

    cardShownAtRef.current = Date.now()
  }, [activeItem?.id])

  useEffect(() => {
    activeVoteTargetRef.current = activeItem
  }, [activeItem])

  const progressLabel =
    deckReady && activeItem && deckItems.length > 0
      ? `${Math.min(currentIndex + 1, deckItems.length)} / ${deckItems.length}`
      : null

  const nextItemPreview = deckReady && activeItem ? displayDeck[currentIndex + 1] ?? null : null

  const handlePersistVote = useCallback(
    async (choice) => {
      if (!votesBackendLive) {
        return { status: 'skipped' }
      }

      const targeting = activeVoteTargetRef.current

      if (!targeting) {
        throw new Error('Missing active look')
      }

      const now = Date.now()
      const shownAt = cardShownAtRef.current || now
      let decisionTimeMs = Math.max(0, Math.round(now - shownAt))

      if (decisionTimeMs > MAX_DECISION_TIME_MS) {
        decisionTimeMs = MAX_DECISION_TIME_MS
      }

      const outcome = await submitVote({
        sessionId,
        itemId: targeting.id,
        choice,
        decisionTimeMs,
      })

      setPersistErrorMessage('')

      if (import.meta.env.DEV && outcome.status === 'duplicate') {
        console.info('[GalaSwipe] Duplicate vote suppressed', { choice, itemId: targeting.id })
      }

      return outcome
    },
    [sessionId, votesBackendLive],
  )

  const persistFailure = useCallback((message) => {
    setPersistErrorMessage(message ?? 'Vote did not persist — try again.')
  }, [])

  const wrappedPersist = votesBackendLive
    ? async (choice) => {
        try {
          return await handlePersistVote(choice)
        } catch (error) {
          persistFailure(error.message)
          throw error
        }
      }
    : undefined

  const handleVoteAdvance = useCallback(
    ({ itemId, lastVoteInserted }) => {
      setPersistErrorMessage('')
      const at = indexRef.current
      setUndoSnap({
        itemId,
        backToIndex: at,
        removeOnUndo: Boolean(votesBackendLive && lastVoteInserted),
      })
      setCurrentIndex(at + 1)
    },
    [votesBackendLive],
  )

  const handleUndoLastSwipe = useCallback(async () => {
    if (!undoSnap) {
      return
    }

    setPersistErrorMessage('')

    if (undoSnap.removeOnUndo) {
      try {
        await undoVote({ sessionId, itemId: undoSnap.itemId })
      } catch (error) {
        setPersistErrorMessage(error.message ?? 'Could not undo vote on server.')
        return
      }
    }

    setCurrentIndex(undoSnap.backToIndex)
    setUndoSnap(null)
  }, [sessionId, undoSnap])

  const voteNo = useCallback(() => swipeRef.current?.swipeNo(), [])
  const voteYes = useCallback(() => swipeRef.current?.swipeYes(), [])

  const handleNavigate = useCallback((tab) => {
    setActiveTab(tab)
  }, [])

  const openResultsTab = useCallback(() => {
    setActiveTab('results')
  }, [])

  const navigateRef = useRef(handleNavigate)
  useEffect(() => {
    navigateRef.current = handleNavigate
  }, [handleNavigate])

  /** Swipe column wrapper — pull-down → Results (document listeners for non-captured gestures; card uses `onPullToResults` because drag captures the pointer). */
  const swipeSurfaceRef = useRef(null)
  const pullToResultsRef = useRef(null)

  useEffect(() => {
    const enabled =
      isReady && deckReady && activeTab === 'swipe' && deckHasCards && !deckFinished

    if (!enabled) {
      pullToResultsRef.current = null
      return undefined
    }

    const shouldTrackTarget = (target) => {
      const surface = swipeSurfaceRef.current
      if (!surface || !(target instanceof Node) || !surface.contains(target)) {
        return false
      }
      if (target instanceof Element && target.closest('button')) {
        return false
      }
      return true
    }

    const tryOpen = (clientX, clientY, start) => {
      const dy = clientY - start.y
      const dx = clientX - start.x
      if (
        dy >= PULL_RESULTS_DY_MIN &&
        dy + PULL_RESULTS_DOWN_VS_HORIZONTAL > Math.abs(dx)
      ) {
        navigateRef.current('results')
        return true
      }
      return false
    }

    const onPointerDown = (e) => {
      if (e.pointerType === 'mouse' && e.button !== 0) {
        return
      }
      if (!shouldTrackTarget(e.target)) {
        return
      }
      pullToResultsRef.current = {
        x: e.clientX,
        y: e.clientY,
        pointerId: e.pointerId,
        fired: false,
      }
    }

    const onPointerMove = (e) => {
      const start = pullToResultsRef.current
      if (!start || start.fired || e.pointerId !== start.pointerId) {
        return
      }
      if (tryOpen(e.clientX, e.clientY, start)) {
        start.fired = true
        pullToResultsRef.current = null
      }
    }

    const onPointerUp = (e) => {
      const start = pullToResultsRef.current
      if (!start || e.pointerId !== start.pointerId) {
        return
      }
      if (!start.fired) {
        tryOpen(e.clientX, e.clientY, start)
      }
      pullToResultsRef.current = null
    }

    const onPointerCancel = (e) => {
      const start = pullToResultsRef.current
      if (start && e.pointerId === start.pointerId) {
        pullToResultsRef.current = null
      }
    }

    const opts = { capture: true, passive: true }

    document.addEventListener('pointerdown', onPointerDown, opts)
    document.addEventListener('pointermove', onPointerMove, opts)
    document.addEventListener('pointerup', onPointerUp, opts)
    document.addEventListener('pointercancel', onPointerCancel, opts)

    return () => {
      document.removeEventListener('pointerdown', onPointerDown, opts)
      document.removeEventListener('pointermove', onPointerMove, opts)
      document.removeEventListener('pointerup', onPointerUp, opts)
      document.removeEventListener('pointercancel', onPointerCancel, opts)
      pullToResultsRef.current = null
    }
  }, [isReady, deckReady, activeTab, deckHasCards, deckFinished])

  const resultsDeck =
    deckReady && deckItems.length > 0 ? displayDeck : sampleDisplayDeck

  return (
    <div className="gala-ambient flex h-full min-h-0 flex-1 flex-col overflow-hidden text-gala-cream">
      {needsSignIn ? <SignInModal onComplete={handleSignInComplete} /> : null}

      <AnimatePresence>
        {isReady && profileOverlayOpen ? (
          <ProfileModal
            key="profile-sheet"
            displayNameLabel={displayName}
            canonicalUserKey={sessionId ?? ''}
            onClose={() => setProfileOverlayOpen(false)}
            onSignOut={handleSignOutVisitor}
          />
        ) : null}
      </AnimatePresence>
      {isReady && !votesBackendLive ? (
        <div className="border-b border-amber-300/25 bg-amber-500/[0.08] px-6 py-3.5 text-left text-[10px] font-semibold uppercase tracking-[0.28em] text-amber-100/95">
          Offline preview • Run `npm run dev:full` for SQLite-backed `/api` (Express on port 4000)
        </div>
      ) : null}

      {isReady && deckErrorMessage && votesBackendLive ? (
        <div className="border-b border-white/[0.08] bg-white/[0.06] px-6 py-3.5 text-[13px] leading-snug text-white/[0.88]">
          {deckErrorMessage}
        </div>
      ) : null}

      {isReady ? (
      <header
        className={`shrink-0 border-b border-white/[0.07] text-left ${
          swipeLayoutTight
            ? 'px-5 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)]'
            : 'px-6 pb-4 pt-[max(env(safe-area-inset-top),1.25rem)] sm:pb-6 sm:pt-[max(env(safe-area-inset-top),1.85rem)]'
        }`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="gala-eyebrow">Met gala nights</p>
            <h1
              className={`font-display leading-[1.05] tracking-[-0.03em] text-gala-cream ${
                swipeLayoutTight
                  ? 'mt-1.5 text-[2.05rem] sm:mt-2 sm:text-[2.4rem]'
                  : 'mt-2 text-[2.25rem] sm:mt-3 sm:text-[2.65rem]'
              }`}
            >
              GalaSwipe
            </h1>
            {votesBackendLive ? (
              <p
                className={`text-[13px] leading-snug text-white/[0.78] ${swipeLayoutTight ? 'mt-1' : 'mt-2'}`}
              >
                Swipe each look yes or no.
              </p>
            ) : (
              <p className={`text-[13px] leading-snug text-white/[0.68] ${swipeLayoutTight ? 'mt-1' : 'mt-2'}`}>
                Sample looks offline — run{' '}
                <kbd className="rounded border border-white/[0.1] bg-black/40 px-1 py-px font-mono text-[11px] text-gala-gold">
                  npm run dev:full
                </kbd>{' '}
                to save votes.
              </p>
            )}
            {displayName ? (
              <p className="mt-2 text-[10px] font-medium uppercase tracking-[0.22em] text-gala-gold/85">
                Signed in as <span className="text-gala-cream">{displayName}</span>
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => setProfileOverlayOpen(true)}
            aria-haspopup="dialog"
            aria-expanded={profileOverlayOpen}
            aria-label="Profile: change display name or sign out"
            className={`tap-highlight-none shrink-0 rounded-full ring-1 ring-white/[0.06] ring-offset-2 ring-offset-gala-ink/0 outline-none transition duration-gala ease-gala focus-visible:ring-2 focus-visible:ring-gala-gold/45 ${
              swipeLayoutTight ? 'mt-1 active:scale-[0.96]' : 'mt-2 sm:mt-3 active:scale-[0.96]'
            }`}
          >
            <ProfileIcon
              className={
                swipeLayoutTight
                  ? 'h-9 w-9 text-gala-gold drop-shadow-[0_6px_16px_rgba(212,178,134,0.2)]'
                  : 'h-11 w-11 text-gala-gold drop-shadow-[0_8px_20px_rgba(212,178,134,0.22)] sm:h-[3rem] sm:w-[3rem]'
              }
            />
          </button>
        </div>
      </header>
      ) : null}

      {isReady && !deckReady ? (
        <div className="flex min-h-0 flex-1 items-center justify-center px-10 text-center text-sm text-white/70">
          Summoning runway looks…
        </div>
      ) : null}

      {isReady && deckReady && activeTab === 'results' ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <ResultsView
            backendEnabled={votesBackendLive}
            catalogBanner={catalogBanner}
            items={resultsDeck}
          />
        </div>
      ) : null}

      {isReady && deckReady && activeTab === 'matches' ? (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <MatchesView
            sessionId={sessionId}
            imageUrlForId={(id) => lookImageById.get(id)}
            backendEnabled={votesBackendLive}
            catalogBanner={catalogBanner}
          />
        </div>
      ) : null}

      {isReady && deckReady && activeTab === 'swipe' ? (
        <div ref={swipeSurfaceRef} className="flex min-h-0 flex-1 flex-col">
          {!deckFinished && progressLabel ? (
            <div className="flex shrink-0 flex-col gap-0.5 px-5 pb-0 pt-1.5 text-[10px] font-semibold uppercase tracking-[0.38em] text-white/[0.48] sm:gap-1.5 sm:px-6 sm:pb-0.5 sm:pt-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="tracking-[0.32em]">Swipe progress</span>
                <span className="gala-pill py-1 text-[11px] tracking-normal sm:py-1.5 sm:text-[12px]">
                  {progressLabel}
                </span>
              </div>
              <p className="text-center normal-case tracking-[0.02em] text-[9px] text-white/[0.34] sm:text-[10px] sm:text-white/[0.36]">
                Swipe or scroll down on the card to open Results
              </p>
            </div>
          ) : null}

          {persistErrorMessage ? (
            <div className="mx-5 mt-1.5 shrink-0 rounded-2xl border border-rose-400/45 bg-rose-950/40 px-3 py-2.5 text-left text-[12px] leading-snug text-rose-50 sm:mx-6 sm:px-4 sm:py-3.5 sm:text-[13px]">
              {persistErrorMessage}
            </div>
          ) : null}

          <main className="relative flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-hidden overscroll-none px-4 pb-0 pt-1 sm:px-5 sm:pb-0.5 sm:pt-2">
            {!deckHasCards ? (
              <div className="flex flex-1 items-center px-6 text-center text-sm text-white/65">
                No outfits yet — start the API once so SQLite can seed the catalog automatically.
              </div>
            ) : null}

            {deckHasCards && !deckFinished && activeItem ? (
              <div className="flex min-h-0 flex-1 flex-col gap-1">
                <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden">
                  {nextItemPreview ? (
                    <motion.div
                      aria-hidden
                      initial={false}
                      animate={{ opacity: 0.32, scale: 0.96, y: 8 }}
                      transition={{ type: 'spring', stiffness: 280, damping: 38 }}
                      className="pointer-events-none absolute inset-x-9 top-3 -z-10 mx-auto h-[112px] max-w-[min(100%,360px)] overflow-hidden rounded-[20px] border border-white/[0.06] shadow-[0_8px_20px_rgba(0,0,0,0.25)] sm:inset-x-10 sm:top-4 sm:h-[128px]"
                    >
                      <img
                        src={nextItemPreview.imageUrl}
                        alt=""
                        className="h-full w-full object-cover object-top opacity-65"
                        draggable={false}
                      />
                    </motion.div>
                  ) : null}

                  <div className="relative z-0 flex min-h-0 flex-1 flex-col px-0">
                    <div className="mx-auto flex h-full min-h-0 w-full max-w-[360px] flex-1 flex-col overflow-hidden">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={activeItem.id}
                          className="flex h-full min-h-0 w-full flex-1 flex-col"
                          initial={{ opacity: 0, scale: 0.96, y: 16 }}
                          animate={{ opacity: 1, scale: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.94, y: -12 }}
                          transition={{ type: 'spring', stiffness: 380, damping: 36, mass: 0.88 }}
                        >
                          <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
                            <SwipeCard
                              ref={swipeRef}
                              item={activeItem}
                              onPersistVote={wrappedPersist}
                              onVoteEnd={handleVoteAdvance}
                              onPullToResults={openResultsTab}
                            />
                          </div>
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </div>
                </div>

                <section className="shrink-0 space-y-1 pb-[max(0.15rem,env(safe-area-inset-bottom))] sm:space-y-1.5">
                  <p className="text-center text-[9px] font-semibold uppercase tracking-[0.34em] text-white/[0.38] sm:text-[10px] sm:text-white/[0.42]">
                    Or tap below
                  </p>
                  <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                    <button
                      type="button"
                      onClick={voteNo}
                      className="rounded-2xl border border-gala-rose/55 bg-gradient-to-b from-gala-rose/25 to-gala-rose/10 px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.32em] text-gala-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition duration-gala ease-gala hover:border-gala-rose/80 hover:from-gala-rose/35 active:scale-[0.98] tap-highlight-none sm:py-3"
                      aria-label="Vote no"
                    >
                      No
                    </button>
                    <button
                      type="button"
                      onClick={voteYes}
                      className="rounded-2xl border border-emerald-400/45 bg-gradient-to-b from-emerald-500/25 to-emerald-600/10 px-4 py-2.5 text-sm font-semibold uppercase tracking-[0.32em] text-gala-cream shadow-[inset_0_1px_0_rgba(255,255,255,0.07)] transition duration-gala ease-gala hover:border-emerald-300/60 hover:from-emerald-400/35 active:scale-[0.98] tap-highlight-none sm:py-3"
                      aria-label="Vote yes"
                    >
                      Yes
                    </button>
                  </div>
                  {undoSnap ? (
                    <button
                      type="button"
                      onClick={() => void handleUndoLastSwipe()}
                      className="w-full rounded-2xl border border-white/[0.12] bg-white/[0.04] py-2 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/72 transition duration-gala ease-gala hover:border-white/25 hover:bg-white/[0.08] active:scale-[0.99] tap-highlight-none sm:py-2.5"
                    >
                      Undo last swipe
                    </button>
                  ) : null}
                </section>
              </div>
            ) : null}

            {deckHasCards && deckFinished ? (
              <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-6">
                {undoSnap ? (
                  <button
                    type="button"
                    onClick={() => void handleUndoLastSwipe()}
                    className="w-full max-w-[320px] rounded-2xl border border-white/[0.12] bg-white/[0.04] py-3.5 text-[10px] font-semibold uppercase tracking-[0.28em] text-white/72 transition duration-gala ease-gala hover:border-white/25 hover:bg-white/[0.08] active:scale-[0.99] tap-highlight-none"
                  >
                    Undo last swipe
                  </button>
                ) : null}
                <EndOfDeckScreen onViewResults={() => handleNavigate('results')} />
              </div>
            ) : null}
          </main>
        </div>
      ) : null}

      {isReady ? (
      <div className="shrink-0 border-t border-white/[0.06] bg-gala-ink/95 shadow-gala-nav backdrop-blur-xl">
        <BottomNav activeTab={activeTab} onChange={handleNavigate} />
      </div>
      ) : null}
    </div>
  )
}
