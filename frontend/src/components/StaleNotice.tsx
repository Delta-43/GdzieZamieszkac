import { useTranslation } from 'react-i18next'
import { useMeta } from '../api/useMeta'
import { useDataWarning } from '../lib/staleWarning'

/** A polite, non-blocking notice. It shows when the API sent X-Data-Warning or when /meta says the data is stale. */
export function StaleNotice() {
  const { t } = useTranslation()
  const warned = useDataWarning()
  const meta = useMeta()
  const stale = meta.data?.stale
  if (!warned && !stale?.is_stale) return null

  return (
    <div role="status" className="stale-notice">
      <p>{t('stale.notice')}</p>
      {/* The reasons come from the API in the chosen language and are shown as given. */}
      {stale && stale.reasons.length > 0 && (
        <ul>
          {stale.reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
