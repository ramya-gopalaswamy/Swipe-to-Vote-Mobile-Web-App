import { useState } from 'react'
import { motion } from 'framer-motion'
import { createSession } from '../lib/galaApi.js'
import { validateUsernamePreview } from '../lib/usernameIdentity.js'
import { ProfileIcon } from './ProfileIcon.jsx'

/**
 * Lightweight demo sign-in: username → **`POST /api/sessions`** → stable `sessionId` in SQLite `users`.
 */
export function SignInModal({ onComplete }) {
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    const preview = validateUsernamePreview(username)

    if ('error' in preview) {
      setErrorMessage(preview.error)
      return
    }

    setBusy(true)
    setErrorMessage('')

    try {
      const bundle = await createSession({ username: username.trim() })
      onComplete(bundle)
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Could not sign in')
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="sign-in-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-7 bg-gala-ink px-6 py-10 gala-ambient"
    >
      <div className="flex flex-col items-center gap-3">
        <ProfileIcon className="h-11 w-11 text-gala-gold drop-shadow-[0_8px_24px_rgba(212,178,134,0.25)] sm:h-[3rem] sm:w-[3rem]" />
        <p className="gala-eyebrow text-center">GalaSwipe</p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 360, damping: 34 }}
        className="gala-card w-full max-w-[340px] space-y-8 p-8"
      >
        <div className="space-y-3 text-left">
          <h1 id="sign-in-title" className="gala-screen-title">
            Username
          </h1>
          <p className="gala-lede">
            Same username restores your votes anywhere (different browser or incognito). This is demo-only—not a secure
            login; anyone could type anyone else&apos;s username.
          </p>
          <p className="text-[11px] leading-snug text-white/[0.45]">
            Rules: trim spaces, lowercase for storage (you can type mixed case—it normalizes). Letters, digits, underscores,
            hyphens only; max length 40.
          </p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-5">
          <div className="space-y-2.5 text-left">
            <label
              htmlFor="username"
              className="text-[10px] font-semibold uppercase tracking-[0.28em] text-white/[0.42]"
            >
              Username
            </label>
            <input
              id="username"
              type="text"
              name="username"
              autoComplete="username"
              maxLength={40}
              disabled={busy}
              value={username}
              onChange={(event) => {
                setUsername(event.target.value)
                setErrorMessage('')
              }}
              placeholder="e.g. runway_critic_01"
              className="w-full rounded-2xl border border-white/[0.12] bg-black/50 px-4 py-3.5 text-sm text-gala-cream shadow-inner placeholder:text-white/28 outline-none transition duration-gala ease-gala focus:border-gala-gold/45 focus:ring-2 focus:ring-gala-gold/20 disabled:opacity-55"
            />
          </div>

          {errorMessage ? (
            <p className="rounded-2xl border border-rose-400/35 bg-rose-950/25 px-3 py-2.5 text-left text-[13px] text-rose-100/92">
              {errorMessage}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={busy}
            className="gala-btn-primary w-full tap-highlight-none disabled:pointer-events-none disabled:opacity-50"
          >
            {busy ? 'Signing in…' : 'Continue'}
          </button>
        </form>

        <p className="text-center text-[10px] leading-relaxed text-white/[0.38]">
          After Continue, tap the <span className="text-gala-gold/85">profile icon</span> top right — sign out clears this
          device only (votes stay on the server).
        </p>
      </motion.div>
    </motion.div>
  )
}
