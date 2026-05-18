/** Mirrors demo rules in README: trim, lowercase, non-empty; [a-z0-9_-]{1,MAX}. */
export const USERNAME_MAX_LEN = 40

const USER_SAFE = /^[a-z0-9_-]+$/

/**
 * @param {unknown} raw
 * @returns {{ error: string } | { normalizedId: string, labelForUi: string }}
 */
export function normalizeAndValidateUsername(raw) {
  if (typeof raw !== 'string') {
    return { error: '`username` must be a non-empty string' }
  }

  const trimmed = raw.trim()

  if (!trimmed) {
    return { error: 'Username cannot be empty (after trimming spaces)' }
  }

  if (trimmed.length > USERNAME_MAX_LEN) {
    return { error: `Username must be at most ${USERNAME_MAX_LEN} characters` }
  }

  const normalizedId = trimmed.toLowerCase()

  if (!USER_SAFE.test(normalizedId)) {
    return {
      error: 'Use only letters (a-z), digits (0-9), underscore (_), hyphen (-)—no spaces or emojis.',
    }
  }

  return { normalizedId, labelForUi: trimmed.slice(0, USERNAME_MAX_LEN) }
}
