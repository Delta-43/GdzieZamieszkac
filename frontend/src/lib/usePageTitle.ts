import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'

/** Sets the browser title to "<page> – <site name>", so each page says what it is. */
export function usePageTitle(title: string) {
  const { t } = useTranslation()
  const siteName = t('site.name')
  useEffect(() => {
    document.title = `${title} – ${siteName}`
  }, [title, siteName])
}
