import { useTranslation } from 'react-i18next'

export function Loading() {
  const { t } = useTranslation()
  return <p role="status">{t('states.loading')}</p>
}
