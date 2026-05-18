export const SESSION_KEY = 'galaswipe-session-id'
export const DISPLAY_NAME_KEY = 'galaswipe-display-name'

/**
 * Prefer localStorage so session survives tab close and browser restart.
 * Migrates legacy sessionStorage id once.
 */
export function readPersistedSessionId() {
  try {
    let id = localStorage.getItem(SESSION_KEY)

    if (!id) {
      id = sessionStorage.getItem(SESSION_KEY)

      if (id) {
        localStorage.setItem(SESSION_KEY, id)
        sessionStorage.removeItem(SESSION_KEY)
      }
    }

    return id
  } catch {
    return null
  }
}

export function readDisplayName() {
  try {
    return localStorage.getItem(DISPLAY_NAME_KEY) ?? ''
  } catch {
    return ''
  }
}

export function sanitizeDisplayName(raw) {
  if (typeof raw !== 'string') {
    return ''
  }

  const collapsed = raw.trim().replace(/\s+/g, ' ').slice(0, 40)

  let out = ''
  for (let i = 0; i < collapsed.length; i += 1) {
    const code = collapsed.charCodeAt(i)

    if (code >= 32 && code !== 127) {
      out += collapsed[i]
    }
  }

  return out
}

/**
 * @param {string} sessionId
 * @param {string} [displayName]
 */
export function persistSessionBundle(sessionId, displayName) {
  const name = sanitizeDisplayName(displayName ?? '')

  localStorage.setItem(SESSION_KEY, sessionId)

  if (name) {
    localStorage.setItem(DISPLAY_NAME_KEY, name)
  } else {
    localStorage.removeItem(DISPLAY_NAME_KEY)
  }
}

/** Removes anonymous session — next load shows sign-in again. */
export function clearPersistedSession() {
  try {
    localStorage.removeItem(SESSION_KEY)
    localStorage.removeItem(DISPLAY_NAME_KEY)
  } catch {
    /* ignore */
  }
}
