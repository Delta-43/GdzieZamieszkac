import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import {
  SCORED_CATEGORIES,
  useBoundaries,
  useCategoryScores,
  useDistrictDetail,
  useDistricts,
  useMetrics,
  useMetricValues,
  type ScoredCategory,
} from '../api/useDistrictsData'
import { useMeta } from '../api/useMeta'
import { DataKindBadge } from '../components/DataKindBadge'
import { DistrictDetails } from '../components/DistrictDetails'
import { DistrictMap, type MapValue } from '../components/DistrictMap'
import { DistrictsTable } from '../components/DistrictsTable'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loading } from '../components/Loading'
import { MapLegend } from '../components/MapLegend'
import { MapPicker, type Choice } from '../components/MapPicker'
import { Tabs } from '../components/Tabs'
import { CLASS_COUNT, classify } from '../lib/classes'
import type { MapView } from '../lib/mapView'
import { plainNumber } from '../lib/plainNumber'
import { usePageTitle } from '../lib/usePageTitle'

// The catalogue key of the default livability score. The map starts with it.
const SCORE_KEY = 'livability_score_default'

function isScoredCategory(value: string | null): value is ScoredCategory {
  return SCORED_CATEGORIES.includes(value as ScoredCategory)
}

/** The choice is kept in the address (?category= or ?metric=), so a view of the map can be shared. */
function choiceFrom(params: URLSearchParams): Choice {
  const category = params.get('category')
  if (isScoredCategory(category)) return { kind: 'category', category }
  const metric = params.get('metric')
  return metric ? { kind: 'metric', key: metric } : { kind: 'overall' }
}

export function DistrictsPage() {
  const { t, i18n } = useTranslation()
  usePageTitle(t('districts.title'))
  const [params, setParams] = useSearchParams()
  const [selected, setSelected] = useState<string | null>(null)
  const [tab, setTab] = useState<'list' | 'details'>('list')
  const choice = choiceFrom(params)

  const districts = useDistricts()
  const boundaries = useBoundaries()
  const metrics = useMetrics()
  const meta = useMeta()
  // The category names arrive only inside a district's detail, so the first district is read for them.
  const labels = useDistrictDetail(districts.data?.districts[0]?.code)

  const metricsByKey = useMemo(() => new Map(metrics.data?.map((m) => [m.key, m])), [metrics.data])
  const categoryLabels = useMemo(() => new Map(labels.data?.categories.map((c) => [c.category as string, c.label])), [labels.data])
  const metric = choice.kind === 'category' ? undefined : (metricsByKey.get(choice.kind === 'metric' ? choice.key : SCORE_KEY) ?? metricsByKey.get(SCORE_KEY))
  const metricValues = useMetricValues(metric?.key ?? '', metric?.available === true)
  const categoryScores = useCategoryScores(choice.kind === 'category' ? choice.category : null)
  const values = choice.kind === 'category' ? categoryScores : metricValues

  const view: MapView | undefined = useMemo(() => {
    if (choice.kind === 'category') {
      const ranking = categoryScores.data?.ranking ?? []
      return {
        label: t('districts.categoryScore', { category: categoryLabels.get(choice.category) ?? choice.category }),
        description: t('districts.categoryMethod'),
        note: categoryScores.data?.note,
        // The recommend answer has no display string for the score (a known contract gap): shown as sent.
        values: ranking.map((item) => ({
          district: item.code,
          value: item.score,
          display: plainNumber(item.score, i18n.language),
          rank: { position: item.rank, of: ranking.length },
        })),
      }
    }
    if (!metric) return undefined
    const source = meta.data?.sources.find((s) => s.metric_keys?.includes(metric.key))
    return {
      label: metric.label,
      description: metric.description,
      unit: metric.unit,
      dataKind: metric.data_kind,
      source: source && { name: source.name, asOf: source.as_of },
      unavailableReason: metric.available ? undefined : (metric.reason ?? t('districts.unavailable')),
      values: (metricValues.data?.values ?? []).map((v) => ({ district: v.district, value: v.value, display: v.display, dataKind: v.data_kind, rank: v.rank })),
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- choice is rebuilt each render; its parts are listed
  }, [choice.kind, choice.kind === 'category' ? choice.category : '', categoryScores.data, categoryLabels, metric, metricValues.data, meta.data, i18n.language, t])

  const { valueOf, classOf, classes } = useMemo(() => {
    const list = view?.values ?? []
    return { valueOf: new Map(list.map((v) => [v.district, v])), ...classify(list) }
  }, [view])

  const base = [districts, boundaries, metrics]
  const failed = base.find((query) => query.isError)
  if (failed) return <ErrorMessage error={failed.error} onRetry={() => base.forEach((query) => void query.refetch())} />
  if (!districts.data || !boundaries.data || !metrics.data || !view) return <Loading />

  const mapValues = new Map<string, MapValue>()
  valueOf.forEach((value, code) => mapValues.set(code, { display: value.display, classNumber: classOf.get(code) ?? 1 }))
  const hasGaps = districts.data.districts.some((district) => !valueOf.has(district.code))
  const waiting = !view.unavailableReason && values.isPending

  function choose(next: Choice) {
    setParams(next.kind === 'category' ? { category: next.category } : next.kind === 'metric' ? { metric: next.key } : {}, { replace: true })
  }

  function select(code: string) {
    setSelected(code)
    setTab('details')
  }

  return (
    <>
      <h1>{t('districts.heading')}</h1>
      <p>{t('districts.intro')}</p>

      <div className="districts-layout">
        <section className="card map-card" aria-labelledby="map-heading">
          <MapPicker choice={choice} onChange={choose} categoryLabels={categoryLabels} metrics={metrics.data} />

          <h2 id="map-heading">{view.label}</h2>
          {view.description && <p>{view.description}</p>}

          {/* A measure without data in this city shows the API's reason, never a zero. */}
          {view.unavailableReason && (
            <p className="notice" role="status">
              {t('districts.unavailable')} {view.unavailableReason}
            </p>
          )}
          {values.isError && <ErrorMessage error={values.error} onRetry={() => void values.refetch()} />}
          {waiting && <Loading />}

          <div className="map-stage">
            <DistrictMap boundaries={boundaries.data} values={mapValues} classCount={CLASS_COUNT} metricLabel={view.label} selected={selected} onSelect={select} />
          </div>

          {classes.length > 0 && <MapLegend classes={classes} hasGaps={hasGaps} />}

          <dl className="provenance">
            {view.dataKind && (
              <div>
                <dt>{t('provenance.dataKind')}</dt>
                <dd>
                  <DataKindBadge kind={view.dataKind} />
                </dd>
              </div>
            )}
            {view.unit && (
              <div>
                <dt>{t('provenance.unit')}</dt>
                <dd>{view.unit}</dd>
              </div>
            )}
            {view.source && (
              <div>
                <dt>{t('provenance.source')}</dt>
                <dd>{view.source.name}</dd>
              </div>
            )}
            {view.source?.asOf && (
              <div>
                <dt>{t('provenance.asOf')}</dt>
                <dd>{view.source.asOf}</dd>
              </div>
            )}
          </dl>
          {/* The API's own note: scores compare the districts of this city only. */}
          <p className="note">{view.note ?? districts.data.score_note}</p>
        </section>

        <section className="card" aria-label={t('districts.tabs.label')}>
          <Tabs
            label={t('districts.tabs.label')}
            active={tab}
            onChange={setTab}
            tabs={[
              {
                key: 'list',
                label: t('districts.tabs.list'),
                panel: (
                  <DistrictsTable
                    districts={districts.data.districts}
                    metricsByKey={metricsByKey}
                    scoreKey={SCORE_KEY}
                    view={view}
                    valueOf={valueOf}
                    classOf={classOf}
                    selected={selected}
                    onSelect={select}
                  />
                ),
              },
              {
                key: 'details',
                label: t('districts.tabs.details'),
                panel: (
                  <div role="status">
                    <DistrictDetails
                      district={districts.data.districts.find((d) => d.code === selected)}
                      view={view}
                      value={selected ? valueOf.get(selected) : undefined}
                      classNumber={selected ? classOf.get(selected) : undefined}
                      categoryLabels={categoryLabels}
                      onBack={() => setTab('list')}
                    />
                  </div>
                ),
              },
            ]}
          />
        </section>
      </div>
    </>
  )
}
