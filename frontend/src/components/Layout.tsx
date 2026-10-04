import { useCallback, useEffect, useId, useRef, useState, type FocusEvent, type PointerEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useMeta } from '../api/useMeta'
import { PAGES } from '../lib/pages'
import { Footer } from './Footer'
import { CloseIcon, MenuIcon } from './Icons'
import { LanguageToggle } from './LanguageToggle'
import { SiteMenu } from './SiteMenu'
import { StaleNotice } from './StaleNotice'

const MAIN_ID = 'main'
// How long the menu stays after the pointer leaves it, so a small slip of the hand does not close it.
const HOVER_CLOSE_MS = 250

/**
 * The menu is closed, open because the pointer is over it, or pinned open by a click or the keyboard.
 * A pinned menu stays until it is closed on purpose; a hovered one closes when the pointer leaves.
 */
type MenuState = 'closed' | 'hover' | 'pinned'

/** The parts every page shares: skip link, header with the menu and the shortcuts, language toggle, stale-data notice and footer. */
export function Layout() {
  const { t } = useTranslation()
  const meta = useMeta()
  const { pathname } = useLocation()
  const menuId = useId()
  const mainRef = useRef<HTMLElement>(null)
  const menuWrapRef = useRef<HTMLDivElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const lastPath = useRef(pathname)
  const leaveTimer = useRef(0)
  const [menu, setMenu] = useState<MenuState>('closed')
  const menuOpen = menu !== 'closed'

  // Closing the menu from inside it (Escape, the close button) gives the focus back to the button that opened it.
  const closeMenu = useCallback(() => {
    window.clearTimeout(leaveTimer.current)
    if (menuWrapRef.current?.contains(document.activeElement)) menuButtonRef.current?.focus()
    setMenu('closed')
  }, [])

  // While the menu is open: Escape closes it, and so does a press anywhere outside it.
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenu()
    }
    const onPress = (event: Event) => {
      if (!menuWrapRef.current?.contains(event.target as Node)) setMenu('closed')
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPress)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPress)
    }
  }, [menuOpen, closeMenu])

  useEffect(() => () => window.clearTimeout(leaveTimer.current), [])

  // After navigation, close the menu, go to the top of the new page and move focus to the main region, so keyboard and
  // screen reader users land on the new page. The first load is not a navigation: the address is compared with the
  // last one, so nothing moves when the page opens (React runs effects twice in development).
  useEffect(() => {
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    window.clearTimeout(leaveTimer.current)
    setMenu('closed')
    document.documentElement.scrollTop = 0
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname])

  // A mouse over the button or the menu opens it; a touch or a pen does not hover, so they use the button.
  function onPointerEnter(event: PointerEvent) {
    if (event.pointerType !== 'mouse') return
    window.clearTimeout(leaveTimer.current)
    setMenu((current) => (current === 'closed' ? 'hover' : current))
  }

  function onPointerLeave(event: PointerEvent) {
    if (event.pointerType !== 'mouse') return
    window.clearTimeout(leaveTimer.current)
    leaveTimer.current = window.setTimeout(() => setMenu((current) => (current === 'hover' ? 'closed' : current)), HOVER_CLOSE_MS)
  }

  // The keyboard left the menu (Tab past its last link): it closes, and the focus goes on to where it was headed.
  function onBlur(event: FocusEvent) {
    if (event.relatedTarget && !menuWrapRef.current?.contains(event.relatedTarget as Node)) setMenu('closed')
  }

  return (
    <>
      <a className="skip-link" href={`#${MAIN_ID}`}>
        {t('skipLink')}
      </a>
      <header className="site-header">
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- the wrapper only watches the pointer and the focus leaving; the button inside it is the control, for every kind of input */}
        <div ref={menuWrapRef} className="menu-wrap" onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave} onBlur={onBlur}>
          {/* The same button opens and closes the menu. Its two icons cross-fade; the word says what it is. */}
          <button
            ref={menuButtonRef}
            type="button"
            className="menu-opener"
            aria-expanded={menuOpen}
            aria-controls={menuId}
            // A click pins a menu that the pointer had only opened, and closes one that is pinned.
            onClick={() => (menu === 'pinned' ? closeMenu() : setMenu('pinned'))}
          >
            <span className="menu-opener__icons">
              <MenuIcon className="menu-opener__open" />
              <CloseIcon className="menu-opener__close" />
            </span>
            {t('nav.menu')}
          </button>
          <SiteMenu id={menuId} open={menuOpen} onClose={closeMenu} />
        </div>
        <p className="site-name">
          <Link to="/">{t('site.name')}</Link>
          {/* The city name comes from /meta and is never written into the code. */}
          {meta.data?.city_name && <span className="site-city">{t('site.city', { city: meta.data.city_name })}</span>}
        </p>
        {/* The steps of the main flow, one press away on a wide screen. On a narrow one they are in the menu only. */}
        <nav className="site-quick" aria-label={t('nav.quick')}>
          <ul>
            {PAGES.filter((page) => page.quick).map((page) => (
              <li key={page.to}>
                <NavLink to={page.to} end={page.end}>
                  {t(page.labelKey)}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
        <LanguageToggle />
      </header>
      <StaleNotice />
      <main id={MAIN_ID} ref={mainRef} tabIndex={-1}>
        <Outlet />
      </main>
      <Footer />
    </>
  )
}
