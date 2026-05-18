import { motion } from 'framer-motion'

export function BottomNav({ activeTab, onChange }) {
  const tabs = [
    { id: 'swipe', label: 'Swipe' },
    { id: 'results', label: 'Results' },
    { id: 'matches', label: 'Matches' },
  ]

  return (
    <nav
      aria-label="Main"
      className="border-t border-white/[0.08] bg-gala-plum/[0.92] px-2 pb-[max(env(safe-area-inset-bottom),0.85rem)] pt-3.5 shadow-gala-nav backdrop-blur-xl"
    >
      <div className="flex max-w-[390px] rounded-2xl border border-white/[0.06] bg-black/45 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
        {tabs.map(({ id, label }) => {
          const selected = activeTab === id
          return (
            <motion.button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => onChange(id)}
              whileTap={{ scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 520, damping: 38 }}
              className={[
                'flex-1 rounded-xl py-3 text-[10px] font-semibold uppercase tracking-[0.16em] transition-colors duration-gala ease-gala sm:text-[11px] sm:tracking-[0.2em] tap-highlight-none',
                selected
                  ? 'bg-gala-cream text-gala-ink shadow-[0_2px_12px_rgba(0,0,0,0.2),inset_0_-1px_0_rgba(0,0,0,0.06)]'
                  : 'text-gala-cream/[0.58] hover:text-gala-cream/95',
              ].join(' ')}
            >
              {label}
            </motion.button>
          )
        })}
      </div>
    </nav>
  )
}
