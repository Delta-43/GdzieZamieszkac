import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { useDistrictDetail, useMetrics } from '../api/useDistrictsData'
import { AreaReport } from '../components/AreaReport'
import { CommuteTable } from '../components/CommuteTable'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loading } from '../components/Loading'
import { MetricRow } from '../components/MetricRow'
import { OutlookCard } from '../components/OutlookCard'
import { PriceHistory } from '../components/PriceHistory'
import { plainNumber } from '../lib/plainNumber'
import { usePageTitle } from '../lib/usePageTitle'

// The catalogue key of the default livability score. It is shown at the top with its full provenance.
const SCORE_KEY = 'livability_score_default'

/** Everything about one district: for every number, where it comes from, when, and how reliable it is. */
export function DistrictPage() {
  const { t, i18n } = useTranslation()
  const { code } = useParams()
  const detail = useDistrictDetail(code)
  // The plain-language description of each measure, from the catalogue, for its "What does this mean?".
  const metrics = useMetrics()
  const describe = (key: string) => metrics.data?.find((metric) => metric.key === key)?.description
  const unknown = detail.error instanceof ApiError && detail.error.status === 404
  usePageTitle(detail.data?.name ?? t(unknown ? 'detail.notFoundTitle' : 'districts.title'))

  if (unknown) {
    return (
      <>
        <h1>{t('detail.notFoundTitle')}</h1>
        <p>{t('detail.notFoundText')}</p>
        <p>
          <Link to="/districts">{t('detail.back')}</Link>
        </p>
      </>
    )
  }
  if (detail.isError) return <ErrorMessage error={detail.error} onRetry={() => void detail.refetch()} />
  if (!detail.data) return <Loading />

  const district = detail.data
  const score = district.categories.flatMap((category) => category.metrics).find((metric) => metric.key === SCORE_KEY)
  const derived = [district.yield_gross, district.payback_years].filter((metric) => metric != null)

  return (
    <>
      <p>
        <Link to="/districts">{t('detail.back')}</Link>
      </p>
      <h1>{district.name}</h1>

      <dl className="metrics card">
        <div className="metric">
          <dt>{t('detail.area')}</dt>
          <dd>
            {/* The area has no display string in the contract yet: shown as sent. */}
            <p className="metric__value">{t('detail.areaValue', { value: plainNumber(district.area_km2, i18n.language) })}</p>
          </dd>
        </div>
        {score && <MetricRow metric={score} description={describe(score.key)} />}
      </dl>
      {/* The API's own note: scores compare the districts of this city only. */}
      {district.score_note && <p className="note">{district.score_note}</p>}

      <div className="card">
        <AreaReport code={district.code} headingLevel="h2" />
      </div>

      <PriceHistory code={district.code} />

      <OutlookCard code={district.code} />

      {derived.length > 0 && (
        <section aria-labelledby="rental-heading">
          <h2 id="rental-heading">{t('detail.rental')}</h2>
          <dl className="metrics card">
            {derived.map((metric) => (
              <MetricRow key={metric.key} metric={metric} description={describe(metric.key)} />
            ))}
          </dl>
        </section>
      )}

      <CommuteTable code={district.code} />

      {district.categories.map((category) => (
        <section key={category.category} aria-labelledby={`category-${category.category}`}>
          <h2 id={`category-${category.category}`}>{category.label}</h2>
          <dl className="metrics card">
            {/* The measures without data come last, together, so the rows with a value read without a break. */}
            {category.metrics
              .filter((metric) => metric.key !== SCORE_KEY)
              .sort((a, b) => Number(a.available === false) - Number(b.available === false))
              .map((metric) => (
                <MetricRow key={metric.key} metric={metric} description={describe(metric.key)} />
              ))}
          </dl>
        </section>
      ))}
    </>
  )
}
