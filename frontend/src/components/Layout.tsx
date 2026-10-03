import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useMeta } from '../api/useMeta'
import { Footer } from './Footer'
import { LanguageToggle } from './LanguageToggle'
import { StaleNotice } from './StaleNotice'

const MAIN_ID = 'main'

/** The parts every page shares: skip link, header, navigation, language toggle, stale-data notice and footer. */
export function Layout() {
  const { t } = useTranslation()
  const meta = useMeta()
  const { pathname } = useLocation()
  const mainRef = useRef<HTMLElement>(null)
  const firstRender = useRef(true)

  // After navigation, move focus to the main region so keyboard and screen reader users land on the new page.
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false
      return
    }
    mainRef.current?.focus()
  }, [pathname])

  return (
    <>
      <a className="skip-link" href={`#${MAIN_ID}`}>
        {t('skipLink')}
      </a>
      <header className="site-header">
        <p className="site-name">
          <Link to="/">{t('site.name')}</Link>
          {/* The city name comes from /meta and is never written into the code. */}
          {meta.data?.city_name && <span className="site-city">{t('site.city', { city: meta.data.city_name })}</span>}
        </p>
        <nav aria-label={t('nav.label')}>
          <ul>
            <li>
              <NavLink to="/" end>
                {t('nav.home')}
              </NavLink>
            </li>
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
