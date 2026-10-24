import type { DemoMetric, DemoModel, Lang } from './model'

// The scoring of the data API (data/sources/derived/scoring.py and backend/app/core/store.py), in the browser, over the sample values.
// A score is a weighted percentile rank within the city, 0 to 100, 100 = best. It compares the districts of one city only.

/** Counts of things, ranked per km2 of district area. */
const PER_KM2 = new Set([
  'transit_stops_total', 'transit_stops_bus', 'transit_stops_tram', 'transit_stops_rail_metro', 'transit_departures_weekday', 'transit_night_departures',
  'amenity_schools', 'amenity_hospitals_clinics', 'amenity_supermarkets', 'amenity_malls', 'amenity_gyms', 'amenity_open_sports_grounds', 'amenity_aed_public',
  'amenity_nursery_places', 'amenity_restaurants_cafes',
])
/** Sub-splits, composite indices and metrics without a direction: never an input of the score. */
const NOT_IN_SCORE = new Set([
  'transit_stops_bus', 'transit_stops_tram', 'transit_stops_rail_metro', 'air_quality_index', 'safety_index', 'livability_score_default', 'night_noise_estimate',
  'busyness_index', 'walkability_index', 'family_friendliness_index', 'heat_exposure_index',
])
/** Shown and ranked, but left out of the table the score is made from. */
const SHOWN_NOT_SCORED = new Set(['amenity_open_sports_grounds', 'amenity_aed_public'])

export const SCORE_KEY = 'livability_score_default'
export const SAFETY_KEY = 'safety_index'
export const CATEGORIES = ['transport', 'demographics', 'livability', 'amenities', 'environment', 'cost', 'safety'] as const
export const CATEGORY_LABELS: Record<string, { en: string; pl: string }> = {
  transport: { en: 'Transport', pl: 'Transport' },
  demographics: { en: 'Demographics', pl: 'Demografia' },
  livability: { en: 'Livability', pl: 'Jakość życia' },
  amenities: { en: 'Amenities', pl: 'Udogodnienia' },
  environment: { en: 'Environment', pl: 'Środowisko' },
  cost: { en: 'Cost', pl: 'Koszty' },
  safety: { en: 'Safety', pl: 'Bezpieczeństwo' },
}

export type Weights = { category?: Record<string, number>; metric?: Record<string, number> }

/** 0-100 percentile (average rank for ties), 100 = best. */
function percentiles(entries: [string, number][], higherIs: 'better' | 'worse'): Map<string, number> {
  const out = new Map<string, number>()
  if (entries.length < 2) {
    entries.forEach(([code]) => out.set(code, 50))
    return out
  }
  const sorted = [...entries].sort((a, b) => a[1] - b[1])
  let i = 0
  while (i < sorted.length) {
    let j = i
    while (j + 1 < sorted.length && sorted[j + 1]![1] === sorted[i]![1]) j++
    const rank = (i + j) / 2 // average of the 0-based ranks of the tied values
    const share = rank / (sorted.length - 1)
    for (let k = i; k <= j; k++) out.set(sorted[k]![0], (higherIs === 'better' ? share : 1 - share) * 100)
    i = j + 1
  }
  return out
}

export type Engine = ReturnType<typeof createEngine>

export function createEngine(model: DemoModel) {
  const codes = model.districts.map((district) => district.code)
  const area = new Map(model.districts.map((district) => [district.code, district.area_km2]))
  const metricByKey = new Map(model.metrics.map((metric) => [metric.key, metric]))

  const directional = (metric: DemoMetric) => metric.higher_is !== 'neutral' && !NOT_IN_SCORE.has(metric.key)

  // Equal weight per category, split equally among the directional metrics of that category (gaps count too, as in the API).
  const used = model.metrics.filter(directional)
  const usedCategories = [...new Set(used.map((metric) => metric.category))]
  const baseWeight = new Map(used.map((metric) => [metric.key, 1 / (usedCategories.length * used.filter((other) => other.category === metric.category).length)]))

  // Percentile table of the scored metrics: metric -> district -> 0..100.
  const table = new Map<string, Map<string, number>>()
  for (const metric of used) {
    if (!metric.available || SHOWN_NOT_SCORED.has(metric.key) || metric.key === SCORE_KEY) continue
    const data = model.values[metric.key]
    if (!data) continue
    const entries = codes.filter((code) => data[code]).map((code): [string, number] => [code, data[code]!.value / (PER_KM2.has(metric.key) ? area.get(code)! : 1)])
    table.set(metric.key, percentiles(entries, metric.higher_is as 'better' | 'worse'))
  }

  /** The score of every district for the given weights; null weights are the default score. */
  function score(weights?: Weights | null) {
    const cat = weights?.category ?? {}
    const met = weights?.metric ?? {}
    const weightOf = (key: string) => (baseWeight.get(key) ?? 0) * (cat[metricByKey.get(key)!.category] ?? 1) * (met[key] ?? 1)
    const keys = [...table.keys()].filter((key) => weightOf(key) > 0)
    const total = keys.reduce((sum, key) => sum + weightOf(key), 0)
    return codes.map((code) => {
      const parts = keys.map((key) => ({ key, percentile: table.get(key)?.get(code) ?? 0, share: weightOf(key) / total }))
      const value = total === 0 ? 0 : parts.reduce((sum, part) => sum + part.percentile * part.share, 0)
      return { code, score: value, parts, usedCount: keys.length }
    })
  }

  const defaultScores = new Map(score().map((item) => [item.code, item.score]))

  // The safety index: the same weighted mean over the metrics of the safety category.
  const safetyKeys = [...table.keys()].filter((key) => metricByKey.get(key)!.category === 'safety')
  const safetyScores = new Map(
    codes.map((code) => [code, safetyKeys.reduce((sum, key) => sum + (table.get(key)?.get(code) ?? 0), 0) / Math.max(1, safetyKeys.length)]),
  )

  /** The value of a metric in a district: stored for most, computed for the two composite scores. */
  function valueOf(key: string, code: string): { value: number; n?: number } | undefined {
    if (key === SCORE_KEY) return { value: Math.round((defaultScores.get(code) ?? 0) * 10) / 10 }
    if (key === SAFETY_KEY) return { value: Math.round((safetyScores.get(code) ?? 0) * 10) / 10 }
    return model.values[key]?.[code]
  }

  /** 1 = best. Ties share the best place. Counts are ranked per km2, as in the API. */
  function rankOf(key: string, code: string): { position: number; of: number; direction: 'higher is better' | 'lower is better' } | undefined {
    const metric = metricByKey.get(key)
    if (!metric || metric.higher_is === 'neutral' || !metric.available) return undefined
    const per = (c: string) => {
      const v = valueOf(key, c)?.value
      return v === undefined ? undefined : v / (PER_KM2.has(key) ? area.get(c)! : 1)
    }
    const mine = per(code)
    if (mine === undefined) return undefined
    const all = codes.map(per).filter((v): v is number => v !== undefined)
    const better = all.filter((v) => (metric.higher_is === 'better' ? v > mine : v < mine)).length
    return { position: better + 1, of: all.length, direction: metric.higher_is === 'better' ? 'higher is better' : 'lower is better' }
  }

  /** The number as the API would print it: the unit after it, the Polish decimal comma. */
  function display(metric: DemoMetric, value: number, lang: Lang): string {
    const text = formatNumber(value, metric.decimals, lang)
    const unit = metric.unit[lang]
    if (!unit) return text
    if (unit.startsWith('%')) return `${text}${unit}`
    if (/^(scale|skala)/.test(unit)) return `${text} (${unit})`
    return `${text} ${unit}`
  }

  function similar(code: string, limit: number) {
    const keys = [...table.keys()]
    const centred = (c: string) => {
      const values = keys.map((key) => table.get(key)?.get(c) ?? 50)
      return values
    }
    const means = keys.map((key) => {
      const row = table.get(key)!
      return [...row.values()].reduce((a, b) => a + b, 0) / row.size
    })
    const vec = (c: string) => centred(c).map((v, i) => v - means[i]!)
    const mine = vec(code)
    const norm = (v: number[]) => Math.hypot(...v)
    return codes
      .filter((other) => other !== code)
      .map((other) => {
        const theirs = vec(other)
        const dot = mine.reduce((sum, v, i) => sum + v * theirs[i]!, 0)
        const cos = dot / (norm(mine) * norm(theirs) || 1)
        const closest = keys
          .map((key, i) => ({ key, gap: Math.abs(mine[i]! - theirs[i]!) }))
          .sort((a, b) => a.gap - b.gap)
          .slice(0, 3)
          .map((item) => item.key)
        return { code: other, similarity: Math.max(0, Math.min(1, Math.round(cos * 100) / 100)), closest_on: closest }
      })
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, limit)
  }

  return { codes, metricByKey, table, score, defaultScores, valueOf, rankOf, display, similar, usedCount: table.size }
}

/** English 12,346.5 and Polish 12 346,5, as the API prints numbers. */
export function formatNumber(value: number, decimals: number, lang: Lang): string {
  const text = new Intl.NumberFormat(lang === 'pl' ? 'pl-PL' : 'en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: true }).format(value)
  return text
}
