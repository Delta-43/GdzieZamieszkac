import { useTranslation } from 'react-i18next'
import { usePageTitle } from '../lib/usePageTitle'

export function HomePage() {
  const { t } = useTranslation()
  usePageTitle(t('home.title'))
  return (
    <>
      <h1>{t('home.heading')}</h1>
      <p>{t('home.what')}</p>
      <p>{t('home.notListings')}</p>
    </>
  )
}
