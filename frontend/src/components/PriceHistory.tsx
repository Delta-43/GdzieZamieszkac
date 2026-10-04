import { useTranslation } from 'react-i18next'
import { useDistrictSeries } from '../api/useDistrictsData'
import { DataKindBadge } from './DataKindBadge'
import { DateText } from './DateText'
import { Loading } from './Loading'
import { PriceChart } from './PriceChart'

// The one metric with a stored history (has_series in the catalogue).
const SERIES_KEY = 'sale_price_median_m2'

/** The quarterly price history of a district: a line chart, a sentence that sums it up, and a table with every value. */
export function PriceHistory({ code }: { code: string }) {
  const { t } = useTranslation()
  const series = useDistrictSeries(code, SERIES_KEY)

  if (series.isPending) return <Loading />
  // A district without stored history shows no history section.
  if (!series.data || series.data.points.length === 0) return null
  const data = series.data

  return (
    <section aria-labelledby="history-heading">
      <h2 id="history-heading">{t('series.heading', { label: data.label ?? data.key })}</h2>
      <div className="history-layout">
        <div className="card">
          <PriceChart series={data} />
          <dl className="provenance">
            {data.data_kind && (
              <div>
                <dt>{t('provenance.dataKind')}</dt>
                <dd>
                  <DataKindBadge kind={data.data_kind} />
                </dd>
              </div>
            )}
            {data.source && (
              <div>
                <dt>{t('provenance.source')}</dt>
                <dd>{data.source.name}</dd>
              </div>
            )}
          </dl>
          {data.caveat && (
            <p className="metric__caveat">
              <strong>{t('metric.caveat')}:</strong> {data.caveat}
            </p>
          )}
          {data.method && (
            <details>
              <summary>{t('metric.more')}</summary>
              <dl className="metric__more">
                <div>
                  <dt>{t('metric.method')}</dt>
                  <dd>{data.method}</dd>
                </div>
                {data.source && (
                  <>
                    <div>
                      <dt>{t('metric.licence')}</dt>
                      <dd>{data.source.licence}</dd>
                    </div>
                    <div>
                      <dt>{t('metric.attribution')}</dt>
                      <dd>{data.source.attribution}</dd>
                    </div>
                  </>
                )}
              </dl>
            </details>
          )}
        </div>
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex -- a scrolling region must be focusable */}
        <div className="card table-scroll table-scroll--tall" role="region" aria-label={t('series.table.region')} tabIndex={0}>
          <table>
            <caption>{t('series.table.caption')}</caption>
            <thead>
              <tr>
                <th scope="col">{t('series.table.period')}</th>
                <th scope="col">{t('series.table.value')}</th>
                <th scope="col">{t('metric.sample')}</th>
                <th scope="col">{t('series.table.confidence')}</th>
              </tr>
            </thead>
            <tbody>
              {data.points.map((point) => (
                <tr key={point.period_start}>
                  <th scope="row">
                    <DateText value={point.period_start} /> – <DateText value={point.period_end} />
                  </th>
                  <td>{point.display}</td>
                  <td>{point.n_obs}</td>
                  <td>{point.low_confidence ? t('series.table.low') : t('series.table.enough')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}
