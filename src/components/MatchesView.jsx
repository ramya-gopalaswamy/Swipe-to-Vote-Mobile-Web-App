import { useCallback, useEffect, useState } from 'react'
import { fetchMatches } from '../lib/galaApi.js'

const POLL_MS = 5000

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

/**
 * Stretch: “matches” = you voted yes AND global yes-rate ≥ 70%.
 * Polls `GET /api/matches` every 5s while mounted and online.
 */
export function MatchesView({ sessionId, imageUrlForId, backendEnabled, catalogBanner }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [polling, setPolling] = useState(false)
  const [error, setError] = useState('')
  const [lastUpdated, setLastUpdated] = useState(null)

  const showOffline = !backendEnabled

  const load = useCallback(
    async ({ silent } = {}) => {
      if (!backendEnabled || !sessionId) {
        return
      }

      if (!silent) {
        setLoading(true)
      } else {
        setPolling(true)
      }

      try {
        const data = await fetchMatches({ sessionId })

        setRows(data)
        setLastUpdated(new Date())
        setError('')
      } catch (err) {
        setError(err.message ?? 'Could not load matches.')
      } finally {
        setLoading(false)
        setPolling(false)
      }
    },
    [backendEnabled, sessionId],
  )

  useEffect(() => {
    if (!backendEnabled || !sessionId) {
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
  }, [backendEnabled, load, sessionId])

  const displayRows = backendEnabled && sessionId ? rows : []

  return (
    <div className="flex min-h-0 min-w-0 flex-1 touch-pan-y flex-col gap-7 overflow-x-hidden overflow-y-auto overscroll-y-contain px-5 pb-[calc(env(safe-area-inset-bottom)+5rem)] pt-11 [-webkit-overflow-scrolling:touch]">
      <header className="shrink-0 space-y-3 text-left">
        <p className="gala-eyebrow">Your alignments</p>
        <h2 className="gala-screen-title">Crowd matches</h2>
        {showOffline ? (
          <p className="text-sm leading-relaxed text-amber-200/90">
            {catalogBanner ?? 'Start the API to load matches (requires your session votes + global tallies).'}
          </p>
        ) : (
          <p className="gala-lede max-w-[40ch]">
            Looks you loved that the crowd also backs — global yes rate at least <span className="text-gala-cream">70%</span>.
          </p>
        )}
      </header>

      {backendEnabled && sessionId ? (
        <>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <div className="flex flex-wrap items-center gap-3 text-[10px] font-semibold uppercase tracking-[0.26em] text-white/[0.48]">
              {loading && rows.length === 0 ? (
                <span>Loading matches…</span>
              ) : (
                <span>{polling ? 'Refreshing…' : 'List ready'}</span>
              )}
              <button
                type="button"
                onClick={() => void load({ silent: rows.length > 0 })}
                className="rounded-full border border-white/[0.18] px-3 py-2 text-[10px] text-gala-cream transition duration-gala ease-gala hover:bg-white/[0.08] disabled:opacity-40 tap-highlight-none"
                disabled={loading && rows.length === 0}
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
          {!showOffline ? (
            <p className="shrink-0 text-center text-[10px] leading-snug text-white/[0.42]">
              Scroll this page — your matches stack below ↓
            </p>
          ) : null}
        </>
      ) : null}

      <div className="-mx-1 shrink-0 pr-1">
        {showOffline ? (
          <p className="gala-card px-5 py-10 text-center text-sm leading-relaxed text-white/[0.58]">
            Matches need live vote data. Run{' '}
            <code className="rounded-md border border-white/10 bg-white/[0.06] px-2 py-0.5 font-mono text-[11px] text-gala-cream/95">
              npm run dev:full
            </code>
            .
          </p>
        ) : !sessionId ? (
          <p className="text-center text-sm text-white/[0.48]">Sign in to see matches.</p>
        ) : loading && rows.length === 0 ? (
          <p className="text-center text-sm text-white/[0.48]">Fetching your runway overlaps…</p>
        ) : error && displayRows.length === 0 ? (
          <p className="rounded-3xl border border-rose-400/35 bg-rose-950/30 px-5 py-8 text-center text-sm text-rose-100/90">
            {error}
          </p>
        ) : displayRows.length === 0 ? (
          <div className="flex flex-col items-center gap-5 rounded-[1.75rem] border border-dashed border-white/[0.14] bg-black/[0.28] px-6 py-14 text-center">
            <p className="gala-screen-title text-[1.4rem]">No matches yet</p>
            <p className="max-w-[280px] text-sm leading-[1.65] text-white/[0.55]">
              Swipe right on looks you love — when the crowd agrees (≥70% yes with enough votes), they land here.
            </p>
          </div>
        ) : (
          <div className="space-y-3 pb-6">
            {displayRows.map((row) => {
              const src = imageUrlForId?.(row.id) ?? row.imageUrl
              const pct = Math.round(row.yes_rate * 100)

              return (
                <article key={row.id} className="gala-card p-4 text-left">
                  <div className="flex flex-col gap-4 sm:flex-row sm:gap-4">
                    <div className="relative mx-auto h-40 w-full max-w-[140px] shrink-0 overflow-hidden rounded-2xl border border-white/[0.1] ring-1 ring-white/[0.04] sm:mx-0">
                      <img src={src} alt="" className="h-full w-full object-cover" draggable={false} />
                      <span className="absolute right-2 top-2 rounded-full bg-emerald-600/95 px-2 py-1 text-[10px] font-semibold tabular-nums text-white shadow-md">
                        {pct}% yes
                      </span>
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <h3 className="font-display text-[1.125rem] leading-snug text-white">{row.title}</h3>
                      <dl className="grid grid-cols-2 gap-3 pt-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/[0.45] sm:grid-cols-4">
                        <div>
                          <dt className="text-emerald-200/85">Yes</dt>
                          <dd className="text-base text-emerald-100">{row.yes_count}</dd>
                        </div>
                        <div>
                          <dt className="text-rose-200/85">No</dt>
                          <dd className="text-base text-rose-100">{row.no_count}</dd>
                        </div>
                        <div className="col-span-2 sm:col-span-2">
                          <dt className="text-gala-gold/90">Global yes</dt>
                          <dd className="text-lg text-white">{pct}%</dd>
                        </div>
                      </dl>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
