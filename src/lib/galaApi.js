/**
 * Normalize item rows from SQLite API (`snake_case` columns).
 * @param {Record<string, unknown>} row
 */
export function normalizeItem(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
  }
}

async function parseJsonResponse(res) {
  const text = await res.text()
  let body = null

  if (text.trim()) {
    try {
      body = JSON.parse(text)
    } catch {
      const preview = text.replace(/\s+/g, ' ').trim().slice(0, 120)
      const hint =
        preview.startsWith('<!') || preview.startsWith('<html')
          ? ' (looks like HTML — is `npm run dev:full` running and PORT matching the Vite proxy?)'
          : ''
      throw new Error(`Invalid JSON response (${res.status}): ${preview}${hint}`)
    }
  }

  if (!res.ok) {
    throw new Error(body?.error ?? `HTTP ${res.status}`)
  }

  return body
}

/**
 * Demo sign-in — stable `sessionId` = normalized username row in SQLite `users`.
 */
export async function createSession({ username }) {
  const res = await fetch('/api/sessions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username }),
  })

  const resBody = await parseJsonResponse(res)

  const sessionId = typeof resBody.sessionId === 'string' ? resBody.sessionId : ''
  const displayName = typeof resBody.displayName === 'string' ? resBody.displayName : sessionId

  if (!sessionId) {
    throw new Error('Invalid session response from server')
  }

  return { sessionId, displayName }
}

/**
 * @returns {Promise<Array<{ id: string; title: string; description: string; imageUrl: string }>>}
 */
export async function fetchItems() {
  const res = await fetch('/api/items')
  const rows = await parseJsonResponse(res)

  return rows.map(normalizeItem)
}

/**
 * Dedup is enforced by SQLite `UNIQUE (session_id, item_id)`.
 *
 * @param {{ sessionId: string; itemId: string; choice: 'yes'|'no'; decisionTimeMs?: number }} payload
 */
export async function submitVote({ sessionId, itemId, choice, decisionTimeMs }) {
  const body = { sessionId, itemId, choice }

  if (decisionTimeMs !== undefined && decisionTimeMs !== null) {
    body.decisionTimeMs = decisionTimeMs
  }

  const res = await fetch('/api/votes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  const resBody = await parseJsonResponse(res)

  return { status: resBody.status }
}

/**
 * Remove the caller’s vote for an item (undo last swipe when `INSERT` succeeded).
 */
export async function undoVote({ sessionId, itemId }) {
  const res = await fetch('/api/undo_vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId, itemId }),
  })

  const body = await parseJsonResponse(res)

  return { status: body.status }
}

/**
 * Items you voted yes on where global yes-rate ≥ 70%.
 * @param {{ sessionId: string }} params
 */
export async function fetchMatches({ sessionId }) {
  const q = new URLSearchParams({ sessionId })
  const res = await fetch(`/api/matches?${q}`)

  const rows = await parseJsonResponse(res)

  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    description: row.description,
    imageUrl: row.image_url,
    yes_count: Number(row.yes_count ?? 0),
    no_count: Number(row.no_count ?? 0),
    yes_rate: Number(row.yes_rate ?? 0),
  }))
}

/**
 * @returns {Promise<{ totalSwipes: number; totalSessions: number; averageDecisionTimeMs: number | null }>}
 */
export async function fetchAnalytics() {
  const res = await fetch('/api/analytics')
  const body = await parseJsonResponse(res)

  return {
    totalSwipes: Number(body.totalSwipes ?? 0),
    totalSessions: Number(body.totalSessions ?? 0),
    averageDecisionTimeMs:
      body.averageDecisionTimeMs === null || body.averageDecisionTimeMs === undefined
        ? null
        : Number(body.averageDecisionTimeMs),
  }
}

/**
 * @returns {Promise<Array<{ item_id: string; yes_count: number; no_count: number }>>}
 */
export async function fetchVoteAggregates() {
  const res = await fetch('/api/results')
  const rows = await parseJsonResponse(res)

  return rows.map((row) => ({
    item_id: row.item_id,
    yes_count: Number(row.yes_count ?? 0),
    no_count: Number(row.no_count ?? 0),
  }))
}

/**
 * Rows this session has voted on (`item_id`, `choice`) in vote order — for resuming swipe after reload.
 * @param {{ sessionId: string }} params
 * @returns {Promise<Array<{ item_id: string; choice: string }>>}
 */
export async function fetchMyVotes({ sessionId }) {
  const q = new URLSearchParams({ sessionId })
  const res = await fetch(`/api/my_votes?${q}`)

  const rows = await parseJsonResponse(res)

  return rows.map((row) => ({
    item_id: String(row.item_id ?? ''),
    choice: String(row.choice ?? ''),
  }))
}
