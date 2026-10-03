import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useMeta } from '../api/useMeta'
import { PAGES } from '../lib/pages'
import { sourceLinks } from '../lib/sourceLinks'
import { ErrorMessage } from './ErrorMessage'
import { Loading } from './Loading'

/**
 * The foot of every page: the site name and its pages on the left; on the right a sentence on what the portal is,
 * then the required credit line of every source from /meta, as the API gives it, linked to where the data comes from.
 */
export function Footer() {
  const { t } = useTranslation()
  const meta = useMeta()

  // Several metrics can share one credit line; show each line once, with every address the API gives for it.
  const credits = new Map<string, string[]>()
  for (const source of meta.data?.sources ?? []) {
    if (!source.attribution) continue
    const links = credits.get(source.attribution) ?? []
    for (const link of sourceLinks(source.url)) if (!links.includes(link)) links.push(link)
    credits.set(source.attribution, links)
  }

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

          <section aria-labelledby="footer-sources">
            <h2 id="footer-sources">{t('footer.sources')}</h2>
            {meta.isPending && <Loading />}
            {meta.isError && <ErrorMessage error={meta.error} onRetry={() => void meta.refetch()} />}
            {meta.isSuccess && (
              <ul className="site-footer__sources">
                {[...credits].map(([credit, links]) => (
                  <li key={credit}>
                    {links[0] ? (
                      <a href={links[0]} target="_blank" rel="noopener noreferrer">
                        {credit}
                        <span className="visually-hidden"> {t('footer.newTab')}</span>
                      </a>
                    ) : (
                      credit
                    )}
                    {/* A source with several addresses: the others follow as numbered links. */}
                    {links.slice(1).map((link, index) => (
                      <a key={link} className="site-footer__more" href={link} target="_blank" rel="noopener noreferrer" aria-label={t('footer.moreLink', { credit, number: index + 2 })}>
                        [{index + 2}]
                      </a>
                    ))}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </footer>
  )
}
