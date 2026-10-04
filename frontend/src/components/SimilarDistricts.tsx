import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ApiError } from '../api/client'
import { useMetrics, useSimilar } from '../api/useDistrictsData'
import { plainNumber } from '../lib/plainNumber'
import { ErrorMessage } from './ErrorMessage'
import { Loading } from './Loading'

/**
 * The districts most like this one, as the API finds them: each with the measures on which the two are closest, by
 * their names from the catalogue, and the similarity as the API sends it. The method is one press away. Similar means
 * alike on the measures, not better or worse. The section is hidden when the API answers 501.
 */
export function SimilarDistricts({ code }: { code: string }) {
  const { t, i18n } = useTranslation()
  const similar = useSimilar(code)
  const metrics = useMetrics()

  if (similar.error instanceof ApiError && similar.error.status === 501) return null
  if (similar.isPending) return <Loading />
  if (similar.isError) return <ErrorMessage error={similar.error} onRetry={() => void similar.refetch()} />
  const data = similar.data
  if (data.similar.length === 0) return null
  const labels = new Map(metrics.data?.map((metric) => [metric.key, metric.label]))

  return (
    <section aria-labelledby="similar-heading">
      <h2 id="similar-heading">{t('similar.heading')}</h2>
      <div className="card">
        <p className="note">{t('similar.intro')}</p>
        <ul className="similar-list">
          {data.similar.map((item) => (
            <li key={item.code}>
              <Link to={`/districts/${item.code}`}>{item.name}</Link>
              {/* The similarity has no display string in the contract yet: shown as sent. */}
              <span className="note">{t('similar.similarity', { value: plainNumber(item.similarity, i18n.language) })}</span>
              {item.closest_on && item.closest_on.length > 0 && (
                <span className="note">
                  {t('similar.closest')}: {item.closest_on.map((key) => labels.get(key) ?? key).join(', ')}
                </span>
              )}
            </li>
          ))}
        </ul>
        <details>
          <summary>{t('metric.more')}</summary>
          <dl className="metric__more">
            <div>
              <dt>{t('metric.method')}</dt>
              <dd>{data.method}</dd>
            </div>
          </dl>
        </details>
      </div>
    </section>
  )
}
