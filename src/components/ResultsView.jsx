import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchAnalytics, fetchVoteAggregates } from '../lib/galaApi.js'

const SORT_MODES = {
  MOST_LOVED: 'most-loved',
  MOST_DIVISIVE: 'most-divisive',
}

const POLL_MS = 5000

function controversyScore(yesVotes, noVotes) {
  const total = yesVotes + noVotes
  if (total <= 1) return 0

  return (yesVotes * noVotes) / (total * total)
}

function buildRows(items, aggregates) {
  const map = new Map(aggregates.map((row) => [row.item_id, row]))

  return items.map((item) => {
    const tally = map.get(item.id) ?? { yes_count: 0, no_count: 0 }
    const yesVotes = Number(tally.yes_count ?? 0)
    const noVotes = Number(tally.no_count ?? 0)
    const totalVotes = yesVotes + noVotes
    const yesRate = totalVotes === 0 ? null : yesVotes / totalVotes

    return {
      ...item,
      yesVotes,
      noVotes,
      totalVotes,
      yesRate,
      controversy: controversyScore(yesVotes, noVotes),
    }
  })
}

function sortRows(rows, mode) {
  const clone = [...rows]

  if (mode === SORT_MODES.MOST_LOVED) {
    clone.sort((a, b) => {
      const ar = a.yesRate ?? -1
      const br = b.yesRate ?? -1

      if (br !== ar) return br - ar

      const yesDiff = (b.yesVotes ?? 0) - (a.yesVotes ?? 0)

      if (yesDiff !== 0) return yesDiff

      return (b.totalVotes ?? 0) - (a.totalVotes ?? 0)
    })

    return clone
  }

  clone.sort((a, b) => {
    const ca = controversyScore(a.yesVotes, a.noVotes)
    const cb = controversyScore(b.yesVotes, b.noVotes)

    if (cb !== ca) return cb - ca

    return (b.totalVotes ?? 0) - (a.totalVotes ?? 0)
  })

  return clone
}

function formatUpdatedAt(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return ''
  }

  return date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatAvgDecisionMs(ms) {
  if (ms === null || ms === undefined || Number.isNaN(ms)) {
    return '—'
  }

  if (ms < 1000) {
    return `${Math.round(ms)} ms`
  }

  return `${(ms / 1000).toFixed(1)} s`
}

export function ResultsView({ items, backendEnabled, catalogBanner }) {
  const [sortMode, setSortMode] = useState(SORT_MODES.MOST_LOVED)
  const [aggregates, setAggregates] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)

  const load = useCallback(
    async ({ silent } = {}) => {
      if (!backendEnabled) {
        return
      }

      if (!silent) {
        setLoading(true)
      } else {
        setPolling(true)
      }

      try {
        const [aggRes, anaRes] = await Promise.allSettled([
          fetchVoteAggregates(),
          fetchAnalytics(),
        ])

        if (aggRes.status === 'rejected') {
          throw aggRes.reason
        }

        setAggregates(aggRes.value)

        if (anaRes.status === 'fulfilled') {
          setAnalytics(anaRes.value)
        }

        setLastUpdated(new Date())
        setError('')
      } catch (err) {
        setError(err.message ?? 'Could not load results.')
      } finally {
        setLoading(false)
        setPolling(false)
      }
    },
    [backendEnabled],
  )

  useEffect(() => {
    if (!backendEnabled) {
      return undefined
    }

    const boot = setTimeout(() => {
      void load({ silent: false })
    }, 0)

    const id = setInterval(() => {
      void load({ silent: true })
    }, POLL_MS)

    return () => {
      clearTimeout(boot)
      clearInterval(id)
    }
  }, [backendEnabled, load])

  const rows = useMemo(() => {
    const displayAggregates = backendEnabled ? aggregates : []

    return sortRows(buildRows(items, displayAggregates), sortMode)
  }, [aggregates, backendEnabled, items, sortMode])

  /** Backend returned successfully but `votes` is empty → every row stays at zero. */
  const noCrowdVotesYet =
    backendEnabled &&
    !loading &&
    !error &&
    lastUpdated !== null &&
    aggregates.length === 0

  // One outer scroll surface (not nested overflow panes): more reliable touch scrolling on mobile.
  return (
    <div className="flex min-h-0 min-w-0 flex-1 touch-pan-y flex-col gap-7 overflow-x-hidden overflow-y-auto overscroll-y-contain px-5 pb-[calc(env(safe-area-inset-bottom)+5rem)] pt-11 [-webkit-overflow-scrolling:touch]">
      <header className="shrink-0 space-y-3 text-left">
        <p className="gala-eyebrow">Gala tally</p>
        <h2 className="gala-screen-title">Live crowd signal</h2>
        {!backendEnabled ? (
          <div className="space-y-2 text-sm leading-relaxed text-amber-200/90">
            <p>
              {catalogBanner ??
                'Run `npm run dev:full` so Express serves SQLite-backed `/api/results` alongside Vite.'}
            </p>
            <p className="text-amber-100/85">
              Tallies stay at zero in this offline preview—the app cannot load `/api/results` until the API is
              reachable.
            </p>
          </div>
        ) : (
          <>
            <p className="gala-lede max-w-[40ch]">
              Counts persist to SQLite via the Express API. Sort the looks to spotlight crowd favorites or
              runway arguments.
            </p>
            {noCrowdVotesYet ? (
              <p className="rounded-3xl border border-white/[0.12] bg-white/[0.05] px-4 py-3 text-sm leading-snug text-white/[0.88]">
                No votes are stored in SQLite yet—every outfit will show 0 until someone swipes with the API
                running. Totals aggregate all sessions sharing the same database file (<code className="text-[0.92em]">data/galaswipe.db</code>).
              </p>
            ) : null}
          </>
        )}
      </header>

      {backendEnabled && analytics ? (
        <section aria-label="Vote analytics" className="gala-card shrink-0 p-5">
          <p className="text-[10px] font-semibold uppercase tracking-[0.38em] text-gala-gold/95">
            Analytics
          </p>
          <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="space-y-1.5">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/[0.42]">
                Swipes
              </dt>
              <dd className="font-display text-[1.65rem] text-gala-cream tabular-nums leading-none">
                {analytics.totalSwipes}
              </dd>
            </div>
            <div className="space-y-1.5">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/[0.42]">
                Sessions
              </dt>
              <dd className="font-display text-[1.65rem] text-gala-cream tabular-nums leading-none">
                {analytics.totalSessions}
              </dd>
            </div>
            <div className="space-y-1.5">
              <dt className="text-[10px] font-semibold uppercase tracking-[0.22em] text-white/[0.42]">
                Avg time
              </dt>
              <dd className="text-[13px] font-semibold normal-case tracking-normal text-gala-cream">
                {formatAvgDecisionMs(analytics.averageDecisionTimeMs)}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-[10px] leading-relaxed text-white/[0.38]">
            Decision time is measured from when a card appears until you vote (server-capped).
          </p>
        </section>
      ) : null}

      <section className="shrink-0 space-y-3.5">
        <p className="text-[10px] font-semibold uppercase tracking-[0.32em] text-white/[0.42]">
          Arrange by
        </p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSortMode(SORT_MODES.MOST_LOVED)}
            aria-pressed={sortMode === SORT_MODES.MOST_LOVED}
            className={`rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] transition duration-gala ease-gala tap-highlight-none ${
              sortMode === SORT_MODES.MOST_LOVED
                ? 'bg-gala-cream text-gala-ink shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]'
                : 'border border-white/[0.12] bg-transparent text-white/[0.58] hover:border-white/25 hover:text-white'
            }`}
          >
            Most-loved
          </button>
          <button
            type="button"
            onClick={() => setSortMode(SORT_MODES.MOST_DIVISIVE)}
            aria-pressed={sortMode === SORT_MODES.MOST_DIVISIVE}
            className={`rounded-full px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.22em] transition duration-gala ease-gala tap-highlight-none ${
              sortMode === SORT_MODES.MOST_DIVISIVE
                ? 'bg-gala-cream text-gala-ink shadow-[inset_0_-1px_0_rgba(0,0,0,0.08)]'
                : 'border border-white/[0.12] bg-transparent text-white/[0.58] hover:border-white/25 hover:text-white'
            }`}
          >
            Most-divisive
          </button>
        </div>
      </section>

      {backendEnabled ? (
        <div className="shrink-0 space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.26em] text-white/[0.48]">
              {loading && aggregates.length === 0 ? (
                <span>Loading tallies…</span>
              ) : (
                <span>{polling ? 'Refreshing…' : 'Tallies up to date'}</span>
              )}
              <button
                type="button"
                onClick={() => void load({ silent: aggregates.length > 0 })}
                className="rounded-full border border-white/[0.18] px-3 py-2 text-[10px] text-gala-cream transition duration-gala ease-gala hover:bg-white/[0.08] disabled:opacity-40 tap-highlight-none"
                disabled={loading && aggregates.length === 0}
              >
                Refresh
              </button>
              {error ? <span className="normal-case text-rose-200/95">{error}</span> : null}
            </div>
            <p className="text-[10px] font-medium normal-case tracking-normal text-white/[0.36]">
              Auto-refreshing every {POLL_MS / 1000}s
              {lastUpdated ? (
                <>
                  {' '}
                  · Last updated {formatUpdatedAt(lastUpdated)}
                </>
              ) : null}
            </p>
          </div>
        </div>
      ) : null}

      {rows.length > 0 ? (
        <p className="mx-auto shrink-0 max-w-[min(100%,340px)] text-center text-[10px] leading-snug text-white/[0.42]">
          Scroll this page — the full rundown is below ↓
        </p>
      ) : null}

      <div className="-mx-1 shrink-0 pr-1">
        {error && aggregates.length === 0 && !loading ? (
          <p className="rounded-3xl border border-rose-400/35 bg-rose-950/30 px-5 py-8 text-center text-sm text-rose-100/90">
            {error}
          </p>
        ) : (
        <div className="space-y-3 pb-6">
          {rows.map((row, index) => (
            <article
              key={row.id}
              className="gala-card p-4 text-left"
            >
              <div className="flex gap-4">
                <div className="relative h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-2xl border border-white/[0.1] ring-1 ring-white/[0.04]">
                  <img src={row.imageUrl} alt="" className="h-full w-full object-cover" draggable={false} />
                  <span className="absolute left-2 top-2 rounded-full bg-black/75 px-2 py-1 text-[10px] font-semibold tabular-nums text-white shadow-md">
                    #{index + 1}
                  </span>
                </div>
                <div className="min-w-0 flex-1 space-y-2">
                  <div>
                    <h3 className="font-display text-[1.125rem] leading-snug text-white">{row.title}</h3>
                    <p className="mt-1.5 text-[11px] uppercase tracking-[0.22em] text-white/[0.38]">
                      {row.totalVotes} vote{row.totalVotes === 1 ? '' : 's'}
                      {sortMode === SORT_MODES.MOST_DIVISIVE && row.totalVotes > 1
                        ? ` · split heat ${Math.round(row.controversy * 100)}%`
                        : null}
                    </p>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-white/50">
                    <div>
                      <dt className="text-emerald-200/85">Yes</dt>
                      <dd className="text-base text-emerald-100">{row.yesVotes}</dd>
                    </div>
                    <div>
                      <dt className="text-rose-200/85">No</dt>
                      <dd className="text-base text-rose-100">{row.noVotes}</dd>
                    </div>
                    <div className="text-right">
                      <dt className="text-gala-gold/90">Yes%</dt>
                      <dd className="text-lg text-white">
                        {row.yesRate === null ? '—' : `${Math.round(row.yesRate * 100)}%`}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>
            </article>
          ))}
        </div>
        )}
      </div>

      {!backendEnabled ? (
        <p className="shrink-0 text-center text-xs text-white/50">
          Once the API is running, totals reflect whatever votes landed in `data/galaswipe.db`.
        </p>
      ) : null}
    </div>
  )
}
