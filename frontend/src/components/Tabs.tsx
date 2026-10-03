import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'

type Tab<Key extends string> = { key: Key; label: string; panel: ReactNode }

/** Tabs with the standard keyboard pattern: Tab reaches the chosen tab, the arrow keys move between tabs. */
export function Tabs<Key extends string>({ label, tabs, active, onChange }: { label: string; tabs: Tab<Key>[]; active: Key; onChange: (key: Key) => void }) {
  const id = useId()
  const buttons = useRef(new Map<Key, HTMLButtonElement>())

  function onKeyDown(event: KeyboardEvent) {
    const index = tabs.findIndex((tab) => tab.key === active)
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (step === 0) return
    event.preventDefault()
    const next = tabs[(index + step + tabs.length) % tabs.length]
    if (!next) return
    onChange(next.key)
    buttons.current.get(next.key)?.focus()
  }

  return (
    <div className="tabs">
      <div role="tablist" aria-label={label} className="tabs__list">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            ref={(element) => {
              if (element) buttons.current.set(tab.key, element)
              else buttons.current.delete(tab.key)
            }}
            type="button"
            className="reserve-bold"
            data-label={tab.label}
            role="tab"
            id={`${id}-tab-${tab.key}`}
            aria-selected={tab.key === active}
            aria-controls={`${id}-panel-${tab.key}`}
            tabIndex={tab.key === active ? 0 : -1}
            onClick={() => onChange(tab.key)}
            onKeyDown={onKeyDown}
          >
            <span>{tab.label}</span>
          </button>
        ))}
      </div>
      {tabs.map((tab) => (
        <div key={tab.key} role="tabpanel" id={`${id}-panel-${tab.key}`} aria-labelledby={`${id}-tab-${tab.key}`} hidden={tab.key !== active} className="tabs__panel">
          {tab.key === active && tab.panel}
        </div>
      ))}
    </div>
  )
}
