import { useTranslation } from 'react-i18next'
import { ApiError } from '../api/client'

function messageKey(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 429) return 'states.error.tooManyRequests' as const
    if (error.status >= 500) return 'states.error.unavailable' as const
  }
  return 'states.error.generic' as const
}

/** Says what happened and what to do next, with a retry button. No blame. */
export function ErrorMessage({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const { t } = useTranslation()
  return (
    <div role="alert" className="error-message">
      <p>{t(messageKey(error))}</p>
      <button type="button" onClick={onRetry}>
        {t('states.retry')}
      </button>
    </div>
  )
}
