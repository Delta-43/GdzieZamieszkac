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
      <p>
        <Link className="button-primary" to="/districts">
          {t('home.cta')}
        </Link>
      </p>
    </>
  )
}
