import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useDistricts } from '../api/useDistrictsData'
import { useMeta } from '../api/useMeta'
import { PAGES } from '../lib/pages'
import { ErrorMessage } from './ErrorMessage'
import { Loading } from './Loading'

/**
 * The foot of every page: the site name and its pages on the left; on the right a sentence on what the portal is,
 * then columns with every district and with the required credit line of every source from /meta, shown as the API gives it.
 */
export function Footer() {
  const { t } = useTranslation()
  const meta = useMeta()
  const districts = useDistricts()
  // Several metrics can share one credit line; show each line once.
  const credits = [...new Set(meta.data?.sources.map((source) => source.attribution).filter(Boolean))]
  const list = districts.data?.districts ?? []

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <nav className="site-footer__side" aria-label={t('footer.nav')}>
          <p className="site-footer__mark">{t('site.name')}</p>
          <ul>
            {PAGES.map((page) => (
              <li key={page.to}>
                <Link to={page.to}>{t(page.labelKey)}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="site-footer__main">
          <p className="site-footer__tagline">{t('footer.tagline')}</p>
          <p className="site-footer__line">{t('home.notListings')}</p>

          <div className="site-footer__columns">
            {list.length > 0 && (
              <nav aria-labelledby="footer-districts">
                <h2 id="footer-districts">{t('nav.groupDistricts')}</h2>
                <ul className="site-footer__districts">
                  {list.map((district) => (
                    <li key={district.code}>
                      <Link to={`/districts/${district.code}`}>{district.name}</Link>
                    </li>
                  ))}
                </ul>
              </nav>
            )}
            <section aria-labelledby="footer-sources">
              <h2 id="footer-sources">{t('footer.sources')}</h2>
              {meta.isPending && <Loading />}
              {meta.isError && <ErrorMessage error={meta.error} onRetry={() => void meta.refetch()} />}
              {meta.isSuccess && (
                <ul>
                  {credits.map((credit) => (
                    <li key={credit}>{credit}</li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </footer>
  )
}
