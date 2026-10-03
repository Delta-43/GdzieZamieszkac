import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { usePageTitle } from '../lib/usePageTitle'

export function HomePage() {
  const { t } = useTranslation()
  usePageTitle(t('home.title'))
  return (
    <>
      <h1>{t('home.heading')}</h1>
      <p>{t('home.what')}</p>
      <p>{t('home.notListings')}</p>
      <p className="find-actions">
        <Link className="button-primary" to="/districts">
          {t('home.cta')}
        </Link>
        <Link className="button-secondary" to="/find">
          {t('nav.findDistrict')}
        </Link>
      </p>
      {/* A concept, not a feature: the city has not approved it, so there is no endpoint and no data (../../TODO.md, P2). */}
      <section className="concept-note" aria-labelledby="notices-heading">
        <h2 id="notices-heading">
          {t('home.notices.heading')} <span className="concept-note__badge">{t('home.notices.badge')}</span>
        </h2>
        <p>{t('home.notices.text')}</p>
      </section>
    </>
  )
}
