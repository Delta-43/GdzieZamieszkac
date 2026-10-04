import { useTranslation } from 'react-i18next'
import type { components } from '../api/schema'
import { DataKindBadge } from './DataKindBadge'

type MetricEntry = components['schemas']['MetricEntry']
type MetricValue = components['schemas']['MetricValue']

function hasValue(metric: MetricEntry): metric is MetricValue {
  return metric.available !== false
}

/**
 * One metric of a district: the API's display string, the rank, the sample size and the caveat. A value that is an
 * estimate or an indirect measure carries its mark beside the number. The rest of what a reader needs to judge it
 * (the data kind in words, the as-of date, the source, the method, the licence and the credit line) is one press
 * away, in a collapsible detail. A metric without data shows its reason, never a zero.
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
          <span>{metric.display}</span>
          {/* An estimate or an indirect measure says so beside the number. A measured value needs no mark: its kind is in the details below. */}
          {metric.data_kind !== 'observed' && (
            <>
              {' '}
              <DataKindBadge kind={metric.data_kind} />
            </>
          )}
        </p>
        <p className="metric__facts">
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
            <div>
              <dt>{t('provenance.dataKind')}</dt>
              <dd>
                <DataKindBadge kind={metric.data_kind} />
              </dd>
            </div>
            <div>
              <dt>{t('provenance.asOf')}</dt>
              <dd>{metric.as_of}</dd>
            </div>
            <div>
              <dt>{t('provenance.source')}</dt>
              <dd>{metric.source.name}</dd>
            </div>
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
