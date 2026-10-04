import { useTranslation } from 'react-i18next'
import { noteText, useFeedbackStatus } from '../api/useFeedback'
import { DataProblemForm, RentPaidForm } from '../components/FeedbackForms'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loading } from '../components/Loading'
import { usePageTitle } from '../lib/usePageTitle'

/**
 * Resident feedback, against the city service. Reports are stored as unverified and never published or used in a score
 * until identity checks exist, so the page says that first, with the service's own note, and sends nothing before it has loaded.
 */
export function FeedbackPage() {
  const { t, i18n } = useTranslation()
  usePageTitle(t('feedback.title'))
  const status = useFeedbackStatus()

  return (
    <>
      <h1>{t('feedback.heading')}</h1>
      <p>{t('feedback.intro')}</p>

      {status.isPending && <Loading />}
      {status.isError && <ErrorMessage error={status.error} onRetry={() => void status.refetch()} />}
      {status.data && (
        // The note is fixed text from the service in both languages, shown as given.
        <div className="notice" lang={i18n.language}>
          <p>{noteText(status.data.note)}</p>
          {status.data.identity_check === 'not_yet' && <p>{t('feedback.noIdentity')}</p>}
        </div>
      )}

      <p className="note">{t('feedback.privacy')}</p>
      <RentPaidForm ready={Boolean(status.data?.accepting)} />
      <DataProblemForm ready={Boolean(status.data?.accepting)} />
    </>
  )
}
