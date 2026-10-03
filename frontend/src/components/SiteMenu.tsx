import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useNavigate } from 'react-router'
import { useDistricts } from '../api/useDistrictsData'
import { useMeta } from '../api/useMeta'
import { PAGES, searchKey } from '../lib/pages'
import { ChevronIcon, CloseIcon, SearchIcon } from './Icons'

/**
 * The main menu: a sheet that slides in from the left. A search field comes first, then groups of links under
 * uppercase labels, each group collapsible. While it is closed it is inert and hidden from assistive software.
 */
export function SiteMenu({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const searchId = useId()
  const closeRef = useRef<HTMLButtonElement>(null)
  const [query, setQuery] = useState('')
  const meta = useMeta()
  const districts = useDistricts()
  const all = districts.data?.districts ?? []
  const matches = all.filter((district) => searchKey(district.name).includes(searchKey(query)))

  // Opening moves the focus into the menu. Escape closes it.
  useEffect(() => {
    if (!open) return
    closeRef.current?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function onSearch(event: FormEvent) {
    event.preventDefault()
    const first = matches[0]
    if (query.trim() && first) {
      setQuery('')
      void navigate(`/districts/${first.code}`)
    }
  }

  return (
    <div className={`site-menu${open ? ' is-open' : ''}`} aria-hidden={!open} inert={!open}>
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions -- the backdrop is a pointer shortcut; the keyboard has the close button and Escape */}
      <div className="site-menu__backdrop" onClick={onClose} />
      <nav id={id} className="site-menu__panel" aria-label={t('nav.label')}>
        <div className="site-menu__top">
          <button ref={closeRef} type="button" className="icon-button" onClick={onClose}>
            <CloseIcon />
            {t('nav.close')}
          </button>
          <span className="site-menu__name">{t('site.name')}</span>
        </div>

        <form className="site-menu__search" role="search" onSubmit={onSearch}>
          <div className="site-menu__field">
            <label htmlFor={searchId}>{t('nav.find')}</label>
            <input id={searchId} type="search" autoComplete="off" value={query} placeholder={t('nav.findPlaceholder')} onChange={(event) => setQuery(event.target.value)} />
            <SearchIcon />
          </div>
          {/* The city is fixed for this portal and comes from /meta. */}
          {meta.data?.city_name && (
            <p className="site-menu__field">
              <span>{t('nav.city')}</span>
              <span>{meta.data.city_name}</span>
            </p>
          )}
        </form>

        <details open>
          <summary>
            {t('nav.groupPortal')}
            <ChevronIcon />
          </summary>
          <ul>
            {PAGES.map((page) => (
              <li key={page.to}>
                <NavLink to={page.to} end={page.end}>
                  {t(page.labelKey)}
                </NavLink>
              </li>
            ))}
          </ul>
        </details>

        <details open>
          <summary>
            {t('nav.groupDistricts')}
            <ChevronIcon />
          </summary>
          {matches.length > 0 ? (
            <ul>
              {matches.map((district) => (
                <li key={district.code}>
                  <NavLink to={`/districts/${district.code}`}>{district.name}</NavLink>
                </li>
              ))}
            </ul>
          ) : (
            <p role="status">{all.length > 0 ? t('nav.noMatch') : t('states.loading')}</p>
          )}
        </details>
      </nav>
    </div>
  )
}
