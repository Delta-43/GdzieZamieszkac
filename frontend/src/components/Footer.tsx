import { useTranslation } from 'react-i18next'
import { useMeta } from '../api/useMeta'
import { sourceLinks } from '../lib/sourceLinks'
import { ErrorMessage } from './ErrorMessage'
import { Loading } from './Loading'

/**
 * The foot of every page: the required credit line of every source from /meta, as the API gives it, linked to where
 * the data comes from. It is small on purpose: the pages are in the menu, and the full list with licences is on the
 * sources page.
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
    </footer>
  )
}
