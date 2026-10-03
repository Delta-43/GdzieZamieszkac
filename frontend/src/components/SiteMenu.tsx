import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { useDistricts } from '../api/useDistrictsData'
import { PAGES } from '../lib/pages'

/**
 * The main menu: a panel that opens from the left edge, under the header. It holds plain sections of links divided by
 * a line: the pages first, then the districts in smaller text. While it is closed it is inert and hidden from
 * assistive software.
 */
export function SiteMenu({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const panelRef = useRef<HTMLDivElement>(null)
  const districts = useDistricts()
  const list = districts.data?.districts ?? []

  // Opening moves the focus into the menu. Escape closes it.
  useEffect(() => {
    if (!open) return
    panelRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <div className={`site-menu${open ? ' is-open' : ''}`} aria-hidden={!open} inert={!open}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- a click beside the menu is a pointer shortcut; the keyboard has Escape and the close button */}
      <div className="site-menu__outside" onClick={onClose} />
      <div id={id} ref={panelRef} className="site-menu__panel" tabIndex={-1}>
        <nav aria-label={t('nav.label')}>
          <ul className="site-menu__section">
            {PAGES.map((page) => (
              <li key={page.to}>
                <NavLink to={page.to} end={page.end}>
                  {t(page.labelKey)}
                </NavLink>
              </li>
            ))}
          </ul>
          {list.length > 0 && (
            <ul className="site-menu__section site-menu__section--secondary" aria-label={t('nav.groupDistricts')}>
              {list.map((district) => (
                <li key={district.code}>
                  <NavLink to={`/districts/${district.code}`}>{district.name}</NavLink>
                </li>
              ))}
            </ul>
          )}
        </nav>
        {/* Reachable at the end of the menu with the keyboard; shown only while it has the focus. */}
        <button type="button" className="site-menu__close" onClick={onClose}>
          {t('nav.close')}
        </button>
      </div>
    </div>
  )
}
