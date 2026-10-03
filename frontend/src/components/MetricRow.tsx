import { useTranslation } from 'react-i18next'
import type { components } from '../api/schema'
import { DataKindBadge } from './DataKindBadge'

type MetricEntry = components['schemas']['MetricEntry']
type MetricValue = components['schemas']['MetricValue']

function hasValue(metric: MetricEntry): metric is MetricValue {
  return metric.available !== false
}

/**
 * One metric of a district with everything a reader needs to judge it: the API's display string, the data kind,
 * the as-of date, the source, the rank, the sample size and the caveat. The method, the licence and the credit line
 * sit in a collapsible detail. A metric without data shows its reason, never a zero.
 */
export function MetricRow({ metric }: { metric: MetricEntry }) {
  const { t } = useTranslation()

  if (!hasValue(metric)) {
    return (
      <div className="metric metric--missing">
        <dt>{metric.label ?? metric.key}</dt>
        <dd>
          <span className="no-data">{t('metric.noData')}</span> {metric.reason}
        </dd>
      </div>
    )
  }

  return (
    <div className="metric">
      <dt>{metric.label}</dt>
      <dd>
        <p className="metric__value">
          <span>{metric.display}</span> <DataKindBadge kind={metric.data_kind} />
        </p>
        <p className="metric__facts">
          <span>
            {t('provenance.asOf')}: {metric.as_of}
          </span>
          <span>
            {t('provenance.source')}: {metric.source.name}
          </span>
          {metric.rank && (
            <span>
              {t('districts.rank', { position: metric.rank.position, of: metric.rank.of })} (
              {t(metric.rank.direction === 'higher is better' ? 'districts.higherIsBetter' : 'districts.lowerIsBetter')})
            </span>
          )}
          {typeof metric.n_obs === 'number' && (
            <span>
              {t('metric.sample')}: {metric.n_obs}
            </span>
          )}
        </p>
        {metric.caveat && (
          <p className="metric__caveat">
            <strong>{t('metric.caveat')}:</strong> {metric.caveat}
          </p>
        )}
        <details>
          <summary>{t('metric.more')}</summary>
          <dl className="metric__more">
            {metric.method && (
              <div>
                <dt>{t('metric.method')}</dt>
                <dd>{metric.method}</dd>
              </div>
            )}
            <div>
              <dt>{t('metric.licence')}</dt>
              <dd>{metric.source.licence}</dd>
            </div>
            <div>
              <dt>{t('metric.attribution')}</dt>
              <dd>{metric.source.attribution}</dd>
            </div>
          </dl>
        </details>
      </dd>
    </div>
  )
}
