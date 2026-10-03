import { useTranslation } from 'react-i18next'
import { useMeta } from '../api/useMeta'
import { ErrorMessage } from './ErrorMessage'
import { Loading } from './Loading'

/** The required credit line of every source from /meta, shown as the API gives it. */
export function Footer() {
  const { t } = useTranslation()
  const meta = useMeta()
  // Several metrics can share one credit line; show each line once.
  const credits = [...new Set(meta.data?.sources.map((source) => source.attribution).filter(Boolean))]

  return (
    <footer className="site-footer">
      <h2>{t('footer.sources')}</h2>
      {meta.isPending && <Loading />}
      {meta.isError && <ErrorMessage error={meta.error} onRetry={() => void meta.refetch()} />}
      {meta.isSuccess && (
        <ul>
          {credits.map((credit) => (
            <li key={credit}>{credit}</li>
          ))}
        </ul>
      )}
    </footer>
  )
}
