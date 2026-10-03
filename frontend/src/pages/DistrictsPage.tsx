import { useId, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { useBoundaries, useDistricts, useMetrics, useMetricValues } from '../api/useDistrictsData'
import { useMeta } from '../api/useMeta'
import { DataKindBadge } from '../components/DataKindBadge'
import { DistrictMap, type MapValue } from '../components/DistrictMap'
import { DistrictsTable } from '../components/DistrictsTable'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loading } from '../components/Loading'
import { MapLegend } from '../components/MapLegend'
import { CLASS_COUNT, classify } from '../lib/classes'
import { usePageTitle } from '../lib/usePageTitle'

// The catalogue key of the default livability score. The map starts with it.
const SCORE_KEY = 'livability_score_default'

export function DistrictsPage() {
  const { t } = useTranslation()
  usePageTitle(t('districts.title'))
  const selectId = useId()
  const [params, setParams] = useSearchParams()
  const [selected, setSelected] = useState<string | null>(null)

  const districts = useDistricts()
  const boundaries = useBoundaries()
  const metrics = useMetrics()
  const meta = useMeta()

  const metricsByKey = useMemo(() => new Map(metrics.data?.map((m) => [m.key, m])), [metrics.data])
  const metric = metricsByKey.get(params.get('metric') ?? SCORE_KEY) ?? metricsByKey.get(SCORE_KEY) ?? metrics.data?.[0]
  const values = useMetricValues(metric?.key ?? '', metric?.available === true)

  const { valueOf, classOf, classes } = useMemo(() => {
    const list = values.data?.values ?? []
    return { valueOf: new Map(list.map((v) => [v.district, v])), ...classify(list) }
  }, [values.data])

  const base = [districts, boundaries, metrics]
  const failed = base.find((query) => query.isError)
  if (failed) return <ErrorMessage error={failed.error} onRetry={() => base.forEach((query) => void query.refetch())} />
  if (!districts.data || !boundaries.data || !metrics.data || !metric) return <Loading />

  const mapValues = new Map<string, MapValue>()
  valueOf.forEach((value, code) => mapValues.set(code, { display: value.display, classNumber: classOf.get(code) ?? 1 }))
  const hasGaps = districts.data.districts.some((district) => !valueOf.has(district.code))
  const source = meta.data?.sources.find((s) => s.metric_keys?.includes(metric.key))
  const selectedDistrict = districts.data.districts.find((d) => d.code === selected)
  const selectedValue = selected ? valueOf.get(selected) : undefined

  return (
    <>
      <h1>{t('districts.heading')}</h1>
      <p>{t('districts.intro')}</p>
      {/* The API's own note: scores compare the districts of this city only. */}
      <p className="note">{districts.data.score_note}</p>

      <div className="field">
        <label htmlFor={selectId}>{t('districts.measure')}</label>
        <select id={selectId} value={metric.key} onChange={(event) => setParams({ metric: event.target.value }, { replace: true })}>
          {metrics.data.map((m) => (
            <option key={m.key} value={m.key}>
              {m.available ? m.label : t('districts.optionNoData', { label: m.label })}
            </option>
          ))}
        </select>
      </div>

      <section className="map-section" aria-labelledby={`${selectId}-heading`}>
        <h2 id={`${selectId}-heading`}>{metric.label}</h2>
        <p>{metric.description}</p>

        {/* A measure without data in this city shows the API's reason, never a zero. */}
        {!metric.available && (
          <p className="notice" role="status">
            {t('districts.unavailable')} {metric.reason}
          </p>
        )}
        {values.isError && <ErrorMessage error={values.error} onRetry={() => void values.refetch()} />}
        {metric.available && values.isPending && <Loading />}

        <div className="map-layout">
          <div className="map-stage">
            <DistrictMap
              boundaries={boundaries.data}
              values={mapValues}
              classCount={CLASS_COUNT}
              metricLabel={metric.label}
              selected={selected}
              onSelect={setSelected}
            />
          </div>

          <div className="map-side">
            {classes.length > 0 && <MapLegend classes={classes} hasGaps={hasGaps} />}

            <dl className="provenance">
              <div>
                <dt>{t('provenance.dataKind')}</dt>
                <dd>
                  <DataKindBadge kind={metric.data_kind} />
                </dd>
              </div>
              <div>
                <dt>{t('provenance.unit')}</dt>
                <dd>{metric.unit}</dd>
              </div>
              {source && (
                <>
                  <div>
                    <dt>{t('provenance.source')}</dt>
                    <dd>{source.name}</dd>
                  </div>
                  {source.as_of && (
                    <div>
                      <dt>{t('provenance.asOf')}</dt>
                      <dd>{source.as_of}</dd>
                    </div>
                  )}
                </>
              )}
            </dl>

            <div className="district-panel" role="status">
              {selectedDistrict ? (
                <>
                  <h3>{selectedDistrict.name}</h3>
                  {selectedValue ? (
                    <>
                      <p className="district-panel__value">
                        {selectedValue.display} {selectedValue.data_kind && <DataKindBadge kind={selectedValue.data_kind} />}
                      </p>
                      {selectedValue.rank && (
                        <p>
                          {t('districts.rank', { position: selectedValue.rank.position, of: selectedValue.rank.of })} (
                          {t(selectedValue.rank.direction === 'higher is better' ? 'districts.higherIsBetter' : 'districts.lowerIsBetter')})
                        </p>
                      )}
                      <p>{t('districts.classOf', { number: classOf.get(selectedDistrict.code), count: CLASS_COUNT })}</p>
                    </>
                  ) : (
                    <p>{t('districts.noData')}</p>
                  )}
                </>
              ) : (
                <p>{t('districts.pick')}</p>
              )}
            </div>
          </div>
        </div>
      </section>

      <DistrictsTable
        districts={districts.data.districts}
        metricsByKey={metricsByKey}
        scoreKey={SCORE_KEY}
        metric={metric}
        valueOf={valueOf}
        classOf={classOf}
        selected={selected}
      />
    </>
  )
}
