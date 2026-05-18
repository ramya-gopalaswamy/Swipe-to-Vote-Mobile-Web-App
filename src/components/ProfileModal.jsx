import { motion } from 'framer-motion'
import { ProfileIcon } from './ProfileIcon.jsx'

/**
 * Read-only demo profile: identity is **`users.id`** (normalized username).
 */
export function ProfileModal({
  /** Optional cosmetic label from signup (often original casing before normalize). */
  displayNameLabel,
  /** Stable key used for **`sessionId`** everywhere (lowercase slug). */
  canonicalUserKey,
  onClose,
  onSignOut,
}) {
  const labelTrim = typeof displayNameLabel === 'string' ? displayNameLabel.trim() : ''

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-modal-title"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[70] flex items-end justify-center bg-black/55 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-10 backdrop-blur-sm sm:items-center sm:pb-10"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose()
        }
      }}
    >
      <motion.div
        layout
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 16 }}
        transition={{ type: 'spring', stiffness: 420, damping: 36 }}
        className="gala-card w-full max-w-[360px] space-y-6 p-6 shadow-gala-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="rounded-full bg-white/[0.06] p-2 ring-1 ring-white/[0.08]" aria-hidden>
              <ProfileIcon className="h-9 w-9 text-gala-gold" />
            </div>
            <div>
              <h2 id="profile-modal-title" className="font-display text-[1.35rem] leading-tight tracking-[-0.02em] text-gala-cream">
                Profile
              </h2>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.2em] text-white/[0.38]">
                Read-only demo identity
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile"
            className="rounded-xl border border-white/[0.1] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/65 transition hover:border-white/[0.2] hover:text-gala-cream tap-highlight-none"
          >
            Close
          </button>
        </div>

        <div className="space-y-3 text-[12px] leading-relaxed text-white/[0.58]">
          {labelTrim ? (
            <p>
              Showing as{' '}
              <span className="font-semibold text-gala-cream">{labelTrim}</span>
            </p>
          ) : null}
          <p>
            Your stable vote key (same everywhere you sign in with this username):
            <br />
            <code className="mt-2 inline-block rounded-lg border border-white/10 bg-black/45 px-2 py-1.5 font-mono text-[11px] leading-snug text-gala-cream">
              {canonicalUserKey}
            </code>
          </p>
          <p className="text-[11px] text-white/[0.45]">
            To change identity, sign out and enter a different username. There is no password — this is coursework demo
            trust.
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            onSignOut()
            onClose()
          }}
          className="w-full rounded-2xl border border-gala-rose/45 bg-transparent py-3 text-[10px] font-semibold uppercase tracking-[0.24em] text-gala-rose/95 transition hover:border-gala-rose/70 hover:bg-gala-rose/[0.08] tap-highlight-none"
        >
          Sign out (clear this device only)
        </button>
      </motion.div>
    </motion.div>
  )
}
