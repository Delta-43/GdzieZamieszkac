import { useTranslation } from 'react-i18next'
import { useMeta } from '../api/useMeta'
import { DEMO } from '../demo/flag'
import { ErrorMessage } from './ErrorMessage'
import { Loading } from './Loading'

/**
 * The foot of every page: the required credit line of every source from /meta, as the API gives it, in small print
 * and as plain text. The links to where the data comes from, and the licences, are on the sources page.
 */
export function Footer() {
  const { t } = useTranslation()
  const meta = useMeta()
  // Several metrics can share one credit line; show each line once.
  const credits = [...new Set((meta.data?.sources ?? []).map((source) => source.attribution).filter(Boolean))]

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <section aria-labelledby="footer-sources">
          <h2 id="footer-sources">{t('footer.sources')}</h2>
          {meta.isPending && <Loading />}
          {meta.isError && <ErrorMessage error={meta.error} onRetry={() => void meta.refetch()} />}
          {meta.isSuccess && (
            <ul className="site-footer__sources">
              {credits.map((credit) => (
                <li key={credit}>{credit}</li>
              ))}
            </ul>
          )}
        </section>
        {/* Who made it, when the data was collected, and under what terms the repository is public. Plain text, like the credit lines. */}
        <section className="site-footer__about" aria-labelledby="footer-about">
          <h2 id="footer-about">{t('footerAbout.heading')}</h2>
          <p>
            {t('footerAbout.project')} {t('footerAbout.team')}
          </p>
          <p>{t('footerAbout.data')}</p>
          <p>
            {t('footerAbout.licence')} {t('footerAbout.repo')}: github.com/Delta-43/GdzieZamieszkac.
          </p>
          {DEMO && <p>{t('footerAbout.demo')}</p>}
        </section>
      </div>
    </footer>
  )
}
