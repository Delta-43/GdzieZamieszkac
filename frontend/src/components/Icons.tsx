// Small line icons, drawn in the text colour. Each one sits beside a text label and is hidden from screen readers.
// One stroke weight for the whole set: 2, to sit beside bold labels.

function Icon({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <svg className={`icon${className ? ` ${className}` : ''}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

export const MenuIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M3 5h14M3 10h14M3 15h14" />
  </Icon>
)

export const CloseIcon = ({ className }: { className?: string }) => (
  <Icon className={className}>
    <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" />
  </Icon>
)
