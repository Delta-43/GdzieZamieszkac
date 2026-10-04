import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router'
import { useDistricts } from '../api/useDistrictsData'
import { PAGES } from '../lib/pages'

/**
 * The main menu: a card that drops from the menu button in the header. It holds plain sections of links divided by a
 * line: every page first, then the districts in smaller text. It is not a dialog: the page under it stays in use,
 * and the focus stays on the button until the person moves into the menu. While it is closed it is inert and hidden
 * from assistive software.
 */
export function SiteMenu({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const districts = useDistricts()
  const list = districts.data?.districts ?? []

  return (
    <div id={id} className={`site-menu${open ? ' is-open' : ''}`} aria-hidden={!open} inert={!open}>
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
  )
}
