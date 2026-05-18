import cors from 'cors'
import express from 'express'
import db from './db.js'
import { normalizeAndValidateUsername } from './username.js'

const app = express()
const PORT = Number(process.env.PORT ?? 4000)

/** Bounds on client-supplied identifiers (reject giant strings / blobs in JSON). */
const SESSION_ID_MAX_LEN = 80
const ITEM_ID_MAX_LEN = 160

app.use(cors({ origin: true }))
app.use(express.json({ limit: '24kb' }))

/**
 * Lightweight demo identity: derive stable `sessionId` from normalized username (`users.id`).
 * No passwords — anyone who guesses a username inherits that profile (fine for coursework).
 *
 * POST { username }
 * → { sessionId, displayName } (200 reuse | 201 new user)
 */
app.post('/api/sessions', (req, res) => {
  const { username } = req.body ?? {}
  const nv = normalizeAndValidateUsername(username)

  if ('error' in nv) {
    return res.status(400).json({ error: nv.error })
  }

  const id = nv.normalizedId
  const { labelForUi } = nv

  try {
    const existing = db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(id)

    if (existing) {
      return res.status(200).json({
        sessionId: existing.id,
        displayName: existing.display_name,
      })
    }

    db.prepare('INSERT INTO users (id, display_name) VALUES (?, ?)').run(id, labelForUi)

    return res.status(201).json({ sessionId: id, displayName: labelForUi })
  } catch (error) {
    const msg = String(error?.message ?? '')
    const code = error?.code ?? ''

    if (code === 'SQLITE_CONSTRAINT_PRIMARYKEY' || code === 'SQLITE_CONSTRAINT_UNIQUE' || msg.includes('UNIQUE')) {
      const row = db.prepare('SELECT id, display_name FROM users WHERE id = ?').get(id)

      if (row) {
        return res.status(200).json({ sessionId: row.id, displayName: row.display_name })
      }
    }

    console.error('[api/sessions]', error)

    return res.status(500).json({ error: error.message ?? 'Database error' })
  }
})

/** Reject obviously spoofed “think times” (10 minutes). */
const MAX_DECISION_TIME_MS = 600_000

function validateSessionItemIds(sessionId, itemId, res) {
  if (
    typeof sessionId !== 'string' ||
    sessionId.length === 0 ||
    sessionId.length > SESSION_ID_MAX_LEN
  ) {
    res.status(400).json({
      error: `sessionId must be a non-empty string, max ${SESSION_ID_MAX_LEN} characters`,
    })
    return false
  }

  if (typeof itemId !== 'string' || itemId.length === 0 || itemId.length > ITEM_ID_MAX_LEN) {
    res.status(400).json({
      error: `itemId must be a non-empty string, max ${ITEM_ID_MAX_LEN} characters`,
    })
    return false
  }

  return true
}

const stmtItemExists = db.prepare('SELECT 1 AS ok FROM items WHERE id = ? LIMIT 1')

function normalizeDecisionTimeMs(raw) {
  if (raw === undefined || raw === null) {
    return null
  }

  const n = typeof raw === 'number' ? raw : Number(raw)

  if (!Number.isFinite(n) || n < 0) {
    return { error: 'decisionTimeMs must be a non-negative number' }
  }

  if (n > MAX_DECISION_TIME_MS) {
    return { value: MAX_DECISION_TIME_MS }
  }

  return { value: Math.round(n) }
}

/** Shared by `POST /api/undo_vote` and legacy `POST /api/votes/undo`. */
function handleUndoVote(req, res) {
  const { sessionId, itemId } = req.body ?? {}

  if (!validateSessionItemIds(sessionId, itemId, res)) {
    return
  }

  try {
    const result = db
      .prepare('DELETE FROM votes WHERE session_id = ? AND item_id = ?')
      .run(sessionId, itemId)

    if (result.changes === 0) {
      return res.json({ status: 'noop' })
    }

    return res.json({ status: 'removed' })
  } catch (error) {
    console.error('[api/undo_vote]', error)
    return res.status(500).json({ error: error.message ?? 'Database error' })
  }
}

app.post('/api/undo_vote', handleUndoVote)
app.post('/api/votes/undo', handleUndoVote)

app.get('/api/items', (_req, res) => {
  try {
    const rows = db
      .prepare(
        `SELECT id, title, description, image_url, sort_order
         FROM items
         ORDER BY sort_order ASC`,
      )
      .all()

    res.json(rows)
  } catch (error) {
    console.error('[api/items]', error)
    res.status(500).json({ error: error.message ?? 'Database error' })
  }
})

app.post('/api/votes', (req, res) => {
  const { sessionId, itemId, choice, decisionTimeMs } = req.body ?? {}

  if (choice !== 'yes' && choice !== 'no') {
    return res.status(400).json({
      error: 'Expected { sessionId, itemId, choice: yes|no, decisionTimeMs? }',
    })
  }

  if (!validateSessionItemIds(sessionId, itemId, res)) {
    return
  }

  if (!stmtItemExists.get(itemId)?.ok) {
    return res.status(400).json({ error: 'Unknown itemId' })
  }

  const dt = normalizeDecisionTimeMs(decisionTimeMs)

  if (dt?.error) {
    return res.status(400).json({ error: dt.error })
  }

  try {
    db.prepare(
      `INSERT INTO votes (session_id, item_id, choice, decision_time_ms)
       VALUES (?, ?, ?, ?)`,
    ).run(sessionId, itemId, choice, dt?.value ?? null)

    return res.status(201).json({ status: 'inserted' })
  } catch (error) {
    const code = error?.code ?? ''
    const msg = String(error?.message ?? '')

    if (code === 'SQLITE_CONSTRAINT_UNIQUE' || msg.includes('UNIQUE')) {
      return res.status(200).json({ status: 'duplicate' })
    }

    console.error('[api/votes]', error)
    return res.status(500).json({ error: error.message ?? 'Database error' })
  }
})

/**
 * All votes recorded for one session — used client-side to resume swipe position after reload.
 * Read-only; `session_id` is client-held (anonymous identity); no auth escalation.
 */
app.get('/api/my_votes', (req, res) => {
  const sessionId = req.query?.sessionId

  if (
    typeof sessionId !== 'string' ||
    sessionId.length === 0 ||
    sessionId.length > SESSION_ID_MAX_LEN
  ) {
    return res.status(400).json({
      error: `Expected ?sessionId= non-empty string, max ${SESSION_ID_MAX_LEN} characters`,
    })
  }

  try {
    const rows = db
      .prepare(
        `SELECT item_id, choice FROM votes WHERE session_id = ? ORDER BY id ASC`,
      )
      .all(sessionId)

    res.json(rows)
  } catch (error) {
    console.error('[api/my_votes]', error)
    res.status(500).json({ error: error.message ?? 'Database error' })
  }
})

app.get('/api/analytics', (_req, res) => {
  try {
    const row = db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM votes) AS total_swipes,
           (SELECT COUNT(DISTINCT session_id) FROM votes) AS total_sessions,
           (SELECT AVG(decision_time_ms) FROM votes WHERE decision_time_ms IS NOT NULL) AS avg_ms`,
      )
      .get()

    res.json({
      totalSwipes: Number(row.total_swipes ?? 0),
      totalSessions: Number(row.total_sessions ?? 0),
      averageDecisionTimeMs:
        row.avg_ms === null || row.avg_ms === undefined ? null : Number(row.avg_ms),
    })
  } catch (error) {
    console.error('[api/analytics]', error)
    res.status(500).json({ error: error.message ?? 'Database error' })
  }
})

app.get('/api/results', (_req, res) => {
  try {
    const rows = db
      .prepare(
        `SELECT
           item_id,
           SUM(CASE WHEN choice = 'yes' THEN 1 ELSE 0 END) AS yes_count,
           SUM(CASE WHEN choice = 'no' THEN 1 ELSE 0 END) AS no_count
         FROM votes
         GROUP BY item_id`,
      )
      .all()

    res.json(rows)
  } catch (error) {
    console.error('[api/results]', error)
    res.status(500).json({ error: error.message ?? 'Database error' })
  }
})

const MATCH_YES_RATE_MIN = 0.7

app.get('/api/matches', (req, res) => {
  const sessionId = req.query?.sessionId

  if (
    typeof sessionId !== 'string' ||
    sessionId.length === 0 ||
    sessionId.length > SESSION_ID_MAX_LEN
  ) {
    return res.status(400).json({
      error: `Expected ?sessionId= non-empty string, max ${SESSION_ID_MAX_LEN} characters`,
    })
  }

  try {
    const rows = db
      .prepare(
        `WITH agg AS (
           SELECT
             item_id,
             SUM(CASE WHEN choice = 'yes' THEN 1 ELSE 0 END) AS yes_count,
             SUM(CASE WHEN choice = 'no' THEN 1 ELSE 0 END) AS no_count
           FROM votes
           GROUP BY item_id
         )
         SELECT
           i.id,
           i.title,
           i.description,
           i.image_url,
           i.sort_order,
           a.yes_count,
           a.no_count,
           CAST(a.yes_count AS REAL) / (a.yes_count + a.no_count) AS yes_rate
         FROM votes u
         JOIN items i ON i.id = u.item_id
         JOIN agg a ON a.item_id = u.item_id
         WHERE u.session_id = ?
           AND u.choice = 'yes'
           AND (a.yes_count + a.no_count) > 0
           AND CAST(a.yes_count AS REAL) / (a.yes_count + a.no_count) >= ?
         ORDER BY yes_rate DESC, a.yes_count DESC`,
      )
      .all(sessionId, MATCH_YES_RATE_MIN)

    res.json(rows)
  } catch (error) {
    console.error('[api/matches]', error)
    res.status(500).json({ error: error.message ?? 'Database error' })
  }
})

app.listen(PORT, () => {
  console.log(`GalaSwipe API + SQLite → http://localhost:${PORT}`)
})
