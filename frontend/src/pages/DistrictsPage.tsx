import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import {
  SCORED_CATEGORIES,
  useBoundaries,
  useCategoryLabels,
  useCategoryScores,
  useDistricts,
  useMetrics,
  useMetricValues,
  type ScoredCategory,
} from '../api/useDistrictsData'
import { useBasemap } from '../api/useBasemap'
import { useMeta } from '../api/useMeta'
import { DataKindBadge } from '../components/DataKindBadge'
import { DistrictDetails } from '../components/DistrictDetails'
import { DistrictMap, type MapValue } from '../components/DistrictMap'
import { DistrictsTable } from '../components/DistrictsTable'
import { ErrorMessage } from '../components/ErrorMessage'
import { Loading } from '../components/Loading'
import { MapLegend } from '../components/MapLegend'
import { MapPicker, type Choice } from '../components/MapPicker'
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
  // ?district= comes from the search on the home page: that district is selected, shown in the details and zoomed to.
  const districtParam = params.get('district')
  // The chosen district. Its details are on the page only while one is chosen.
  const [selected, setSelected] = useState<string | null>(districtParam)
  const choice = choiceFrom(params)

  const districts = useDistricts()
  const boundaries = useBoundaries()
  const metrics = useMetrics()
  const meta = useMeta()
  const basemap = useBasemap()
  const categoryLabels = useCategoryLabels()

  const metricsByKey = useMemo(() => new Map(metrics.data?.map((m) => [m.key, m])), [metrics.data])
  const metric = choice.kind === 'category' ? undefined : (metricsByKey.get(choice.kind === 'metric' ? choice.key : SCORE_KEY) ?? metricsByKey.get(SCORE_KEY))
  const metricValues = useMetricValues(metric?.key ?? '', metric?.available === true)
  const categoryScores = useCategoryScores(choice.kind === 'category' ? choice.category : null)
  const values = choice.kind === 'category' ? categoryScores : metricValues

  // The parts of `choice` the view depends on: `choice` itself is rebuilt on every render.
  const category = choice.kind === 'category' ? choice.category : null
  const kind = choice.kind
  const view: MapView | undefined = useMemo(() => {
    if (kind === 'category' && category) {
      const ranking = categoryScores.data?.ranking ?? []
      return {
        label: t('districts.categoryScore', { category: categoryLabels.get(category) ?? category }),
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
  }, [
    kind,
    category,
    categoryScores.data,
    categoryLabels,
    metric,
    metricValues.data,
    meta.data,
    i18n.language,
    t,
  ])

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

  // The two values every district carries (the prices), for its card on the map.
  const extras = new Map(
    districts.data.districts.map((district) => [
      district.code,
      (district.highlights ?? []).map((highlight) => ({ label: metricsByKey.get(highlight.key)?.label ?? highlight.key, display: highlight.display })),
    ]),
  )
  const chosen = districts.data.districts.find((district) => district.code === selected)

  return (
    <>
      <h1>{t('districts.heading')}</h1>
      <p>{t('districts.intro')}</p>

      <div className="districts-layout">
        {/* The map comes first and alone: it is what people come for. */}
        <section className="card map-card" aria-labelledby="map-heading">
          <h2 id="map-heading">{view.label}</h2>
          {/* A measure without data in this city shows the API's reason, never a zero. */}
          {view.unavailableReason && (
            <p className="notice" role="status">
              {t('districts.unavailable')} {view.unavailableReason}
            </p>
          )}
          {values.isError && <ErrorMessage error={values.error} onRetry={() => void values.refetch()} />}
          {waiting && <Loading />}
          <div className="map-stage">
            <DistrictMap
              boundaries={boundaries.data}
              values={mapValues}
              classCount={CLASS_COUNT}
              metricLabel={view.label}
              loading={waiting}
              selected={selected}
              onSelect={setSelected}
              basemap={basemap}
              focusCode={districtParam}
              classes={classes}
              extras={extras}
              card
            />
          </div>
          {classes.length > 0 && <MapLegend classes={classes} hasGaps={hasGaps && !waiting} />}
        </section>

        {/* The details of the chosen district: on the page only after a district is chosen, and announced politely when it changes. */}
        {chosen && (
          <section className="card" aria-label={t('districts.detailsLabel')}>
            <div role="status">
              <DistrictDetails
                district={chosen}
                view={view}
                value={valueOf.get(chosen.code)}
                classNumber={classOf.get(chosen.code)}
                categoryLabels={categoryLabels}
                onBack={() => setSelected(null)}
              />
            </div>
          </section>
        )}
      </div>

      <div className="districts-below">
        <section className="card" aria-label={t('districts.pickerLabel')}>
          <MapPicker choice={choice} onChange={choose} categoryLabels={categoryLabels} metrics={metrics.data} />
          {/* The method comes after the choice: this is what stands behind the map. */}
          {view.description && <p>{view.description}</p>}
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

        <section className="card" aria-labelledby="list-heading">
          <h2 id="list-heading">{t('districts.listHeading')}</h2>
          <DistrictsTable
            districts={districts.data.districts}
            metricsByKey={metricsByKey}
            scoreKey={SCORE_KEY}
            view={view}
            showView={choice.kind !== 'overall'}
            valueOf={valueOf}
            selected={selected}
            onSelect={setSelected}
          />
        </section>
      </div>
    </>
  )
}
