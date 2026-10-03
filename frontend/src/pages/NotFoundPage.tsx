import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { usePageTitle } from '../lib/usePageTitle'

export function NotFoundPage() {
  const { t } = useTranslation()
  usePageTitle(t('notFound.title'))
  return (
    <>
      <h1>{t('notFound.title')}</h1>
      <p>{t('notFound.text')}</p>
      <p>
        <Link to="/">{t('notFound.back')}</Link>
      </p>
    </>
  )
}
