// Small line icons, drawn in the text colour. Each one sits beside a text label and is hidden from screen readers.

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg className="icon" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

export const MenuIcon = () => (
  <Icon>
    <path d="M3 5h14M3 10h14M3 15h14" />
  </Icon>
)

export const CloseIcon = () => (
  <Icon>
    <path d="M4.5 4.5l11 11M15.5 4.5l-11 11" />
  </Icon>
)

export const ChevronIcon = () => (
  <Icon>
    <path d="M5 7.5l5 5 5-5" strokeLinejoin="round" />
  </Icon>
)

export const SearchIcon = () => (
  <Icon>
    <circle cx="8.5" cy="8.5" r="5" />
    <path d="M12.5 12.5l4 4" />
  </Icon>
)
