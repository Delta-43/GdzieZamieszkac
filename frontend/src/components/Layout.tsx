import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, Outlet, useLocation } from 'react-router'
import { useMeta } from '../api/useMeta'
import { Footer } from './Footer'
import { MenuIcon } from './Icons'
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
  const firstRender = useRef(true)
  const [menuOpen, setMenuOpen] = useState(false)

  // Closing the menu gives the focus back to the button that opened it.
  const closeMenu = useCallback(() => {
    setMenuOpen(false)
    menuButtonRef.current?.focus()
  }, [])

  // After navigation, close the menu and move focus to the main region, so keyboard and screen reader users land on the new page.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    setMenuOpen(false)
    mainRef.current?.focus()
  }, [pathname])

  return (
    <>
      {/* While the menu is open, the page behind it is inert: the keyboard and screen readers stay in the menu. */}
      <div inert={menuOpen}>
        <a className="skip-link" href={`#${MAIN_ID}`}>
          {t('skipLink')}
        </a>
        <header className="site-header">
          <div className="site-header__bar">
            <button ref={menuButtonRef} type="button" className="icon-button" aria-expanded={menuOpen} aria-controls={menuId} onClick={() => setMenuOpen(true)}>
              <MenuIcon />
              {t('nav.menu')}
            </button>
            <p className="site-name">
              <Link to="/">{t('site.name')}</Link>
              {/* The city name comes from /meta and is never written into the code. */}
              {meta.data?.city_name && <span className="site-city">{t('site.city', { city: meta.data.city_name })}</span>}
            </p>
            <LanguageToggle />
          </div>
        </header>
        <StaleNotice />
        <main id={MAIN_ID} ref={mainRef} tabIndex={-1}>
          <Outlet />
        </main>
        <Footer />
      </div>
      <SiteMenu id={menuId} open={menuOpen} onClose={closeMenu} />
    </>
  )
}
