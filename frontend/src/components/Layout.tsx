import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation } from 'react-router'
import { useMeta } from '../api/useMeta'
import { Footer } from './Footer'
import { CloseIcon, MenuIcon } from './Icons'
import { LanguageToggle } from './LanguageToggle'
import { SiteMenu } from './SiteMenu'
import { StaleNotice } from './StaleNotice'

const MAIN_ID = 'main'

/** The parts every page shares: skip link, header with the menu button, the menu, language toggle, stale-data notice and footer. */
export function Layout() {
  const { t } = useTranslation()
  const meta = useMeta()
  const { pathname } = useLocation()
  const menuId = useId()
  const mainRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const lastPath = useRef(pathname)
  const [menuOpen, setMenuOpen] = useState(false)

  // Closing the menu gives the focus back to the button that opened it.
  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    menuButtonRef.current?.focus()
  }, [])

  // After navigation, close the menu, go to the top of the new page and move focus to the main region, so keyboard and
  // screen reader users land on the new page. The first load is not a navigation: the address is compared with the
  // last one, so nothing moves when the page opens (React runs effects twice in development).
  useEffect(() => {
    if (lastPath.current === pathname) return
    lastPath.current = pathname
    setMenuOpen(false)
    document.documentElement.scrollTop = 0
    mainRef.current?.focus({ preventScroll: true })
  }, [pathname])

  return (
    <>
      <a className="skip-link" href={`#${MAIN_ID}`}>
        {t('skipLink')}
      </a>
      <header className="site-header">
        {/* The same button opens and closes the menu. Its two icons cross-fade; the word says what it is. */}
        <button
          ref={menuButtonRef}
          type="button"
          className="menu-opener"
          aria-expanded={menuOpen}
          aria-controls={menuId}
          onClick={() => (menuOpen ? closeMenu() : setMenuOpen(true))}
        >
          <span className="menu-opener__icons">
            <MenuIcon className="menu-opener__open" />
            <CloseIcon className="menu-opener__close" />
          </span>
          {t('nav.menu')}
        </button>
        <p className="site-name">
          <Link to="/">{t('site.name')}</Link>
          {/* The city name comes from /meta and is never written into the code. */}
          {meta.data?.city_name && <span className="site-city">{t('site.city', { city: meta.data.city_name })}</span>}
        </p>
        <LanguageToggle />
      </header>
      <SiteMenu id={menuId} open={menuOpen} onClose={closeMenu} />
      {/* While the menu is open, the page under it is inert: the keyboard and screen readers stay in the header and the menu. */}
      <div inert={menuOpen}>
        <StaleNotice />
        <main id={MAIN_ID} ref={mainRef} tabIndex={-1}>
          <Outlet />
        </main>
        <Footer />
      </div>
    </>
  )
}
