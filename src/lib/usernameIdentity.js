/** Client-side UX checks — mirror `server/username.js` so errors match before POST. */

export const USERNAME_MAX_LEN = 40

const USER_SAFE = /^[a-z0-9_-]+$/

/**
 * @param {unknown} raw
 * @returns {{ error: string } | { normalizedId: string }}
 */
export function validateUsernamePreview(raw) {
  if (typeof raw !== 'string') {
    return { error: 'Enter a username' }
  }

  const trimmed = raw.trim()

  if (!trimmed) {
    return { error: 'Username cannot be empty' }
  }

  if (trimmed.length > USERNAME_MAX_LEN) {
    return { error: `At most ${USERNAME_MAX_LEN} characters` }
  }

  const normalizedId = trimmed.toLowerCase()

  if (!USER_SAFE.test(normalizedId)) {
    return {
      error: 'Use only letters, numbers, underscore (_) and hyphen (-). No spaces.',
    }
  }

  return { normalizedId }
}
