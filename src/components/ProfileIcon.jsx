/**
 * User / profile silhouette for sign-in context and header.
 */
export function ProfileIcon({ className = 'h-9 w-9 text-gala-gold' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="12" cy="8.5" r="3.25" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M5.5 20.25v-.35a4.75 4.75 0 0 1 4.75-4.75h3.5a4.75 4.75 0 0 1 4.75 4.75v.35"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  )
}
