import type { components } from '../api/schema'

// Test-only values, obviously made up. They are typed by the contract and never shown to users.
export const metaFixture: components['schemas']['Meta'] = {
  city: 'testcity',
  city_name: 'Testowo',
  default_lang: 'en',
  languages: ['en', 'pl'],
  district_count: 4,
  data_version: 'test-version',
  latest_ingestion_run: null,
  stale: { is_stale: false, reasons: [] },
  sources: [
    { name: 'Test source A', licence: 'Test licence', attribution: 'Test credit line A', as_of: '2026-09-30' },
    { name: 'Test source A, second table', licence: 'Test licence', attribution: 'Test credit line A' },
    { name: 'Test source B', licence: 'Test licence', attribution: 'Test credit line B' },
  ],
  score_note: 'Test score note.',
}

export const problemFixture: components['schemas']['Problem'] = {
  type: 'about:blank',
  title: 'Data unavailable',
  status: 503,
}

export function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json', ...headers },
  })
}

type Schemas = components['schemas']

const square = (x: number): Schemas['BoundaryCollection']['features'][number] => ({
  type: 'Feature',
  // The contract types the geometry as a plain object, so the test shape is cast.
  geometry: { type: 'Polygon', coordinates: [[[x, 0], [x + 1, 0], [x + 1, 1], [x, 1], [x, 0]]] } as never,
  properties: { code: ['alpha', 'beta', 'gamma', 'delta'][x] ?? '', name: ['Alpha', 'Beta', 'Gamma', 'Delta'][x] ?? '' },
})

export const boundariesFixture: Schemas['BoundaryCollection'] = { type: 'FeatureCollection', features: [0, 1, 2, 3].map(square) }

const highlights = (sale: string, rent: string): Schemas['Highlight'][] => [
  { key: 'test_sale', display: sale, data_kind: 'observed' },
  { key: 'test_rent', display: rent, data_kind: 'estimated' },
]

export const districtsFixture = {
  lang: 'pl' as const,
  score_note: 'Test score note from the API.',
  districts: [
    { code: 'alpha', name: 'Alpha', area_km2: 10.5, livability_score: 61.5, highlights: highlights('100 test', '10 test') },
    { code: 'beta', name: 'Beta', area_km2: 20, livability_score: 40, highlights: highlights('200 test', '20 test') },
    { code: 'gamma', name: 'Gamma', area_km2: 15, livability_score: null, highlights: highlights('300 test', '30 test') },
    { code: 'delta', name: 'Delta', area_km2: 5, livability_score: 55, highlights: [] },
  ] satisfies Schemas['DistrictListItem'][],
}

const definition = (key: string, label: string, extra: Partial<Schemas['MetricDefinition']> = {}): Schemas['MetricDefinition'] => ({
  key,
  category: 'cost',
  label,
  description: `${label} description from the API.`,
  unit: 'test unit',
  higher_is: 'worse',
  refresh_cadence: 'static',
  data_kind: 'observed',
  available: true,
  ...extra,
})

export const metricsFixture = {
  lang: 'pl' as const,
  metrics: [
    definition('livability_score_default', 'Test score label', { category: 'livability', higher_is: 'better', data_kind: 'estimated' }),
    definition('test_sale', 'Test sale label'),
    definition('test_rent', 'Test rent label', { data_kind: 'estimated' }),
    definition('test_gap', 'Test gap label', { category: 'safety', available: false, reason: 'Test reason for the gap.' }),
  ],
}

const value = (district: string, v: number, position: number): Schemas['MetricValues']['values'][number] => ({
  district,
  value: v,
  display: `${v} test`,
  data_kind: 'observed',
  n_obs: null,
  rank: { position, of: 3, direction: 'lower is better' },
})

/** Three of the four districts have a value. Delta has none, so it must show as "no data". */
export const metricValuesFixture: Schemas['MetricValues'] = {
  key: 'test_sale',
  label: 'Test sale label',
  lang: 'pl',
  higher_is: 'worse',
  values: [value('alpha', 100, 1), value('beta', 200, 2), value('gamma', 300, 3)],
}

const saleMetricBase: Schemas['MetricValue'] = {
  key: 'test_sale',
  available: true,
  label: 'Test sale label',
  display: '100 test',
  value: 100,
  unit: 'test unit',
  data_kind: 'observed',
  n_obs: 42,
  as_of: '2026-09-30',
  source: { name: 'Test source A', licence: 'Test licence text', attribution: 'Test credit line A' },
  method: 'Test method text.',
  caveat: 'Test caveat from the API.',
  rank: { position: 2, of: 4, direction: 'lower is better' },
}
const saleMetric = saleMetricBase
const gapMetric: Schemas['UnavailableMetric'] = { key: 'test_gap', available: false, label: 'Test gap label', reason: 'Test reason for the gap.' }
const scoreMetric: Schemas['MetricValue'] = {
  ...saleMetricBase,
  key: 'livability_score_default',
  label: 'Test score label',
  display: '61,5 test points',
  data_kind: 'estimated',
  caveat: null,
  rank: { position: 1, of: 4, direction: 'higher is better' },
}

const CATEGORY_KEYS = ['transport', 'demographics', 'livability', 'amenities', 'environment', 'cost', 'safety'] as const

/** A district detail with no metrics: the districts page reads only the category labels from it. */
export const detailFixture: Schemas['DistrictDetail'] = {
  code: 'alpha',
  name: 'Alpha',
  area_km2: 10.5,
  lang: 'pl',
  livability_score: 61.5,
  score_note: 'Test score note from the API.',
  categories: CATEGORY_KEYS.map((category) => ({
    category,
    label: `Test ${category} label`,
    metrics: category === 'cost' ? [saleMetric, gapMetric] : category === 'livability' ? [scoreMetric] : [],
  })),
  yield_gross: { ...saleMetricBase, key: 'yield_gross', label: 'Test yield label', display: '5 test percent', data_kind: 'estimated' },
  payback_years: null,
}

/** Three quarters. The second rests on few observations and is marked low confidence. */
export const seriesFixture: Schemas['Series'] = {
  district: 'alpha',
  key: 'sale_price_median_m2',
  label: 'Test series label',
  lang: 'pl',
  unit: 'test unit',
  data_kind: 'observed',
  min_obs: 30,
  source: { name: 'Test series source', licence: 'Test series licence', attribution: 'Test series credit' },
  method: 'Test series method.',
  caveat: 'Test series caveat from the API.',
  points: [
    { period_start: '2025-01-01', period_end: '2025-03-31', value: 100, display: '100 test', n_obs: 40, low_confidence: false },
    { period_start: '2025-04-01', period_end: '2025-06-30', value: 80, display: '80 test', n_obs: 7, low_confidence: true },
    { period_start: '2025-07-01', period_end: '2025-09-30', value: 120, display: '120 test', n_obs: 55, low_confidence: false },
  ],
}

export const reportFixture: Schemas['Report'] = {
  district: 'beta',
  lang: 'pl',
  lang_fallback: false,
  livability_score: 40,
  body: 'Test report first paragraph.\n\nTest report second paragraph.',
  model: 'test-model',
  generated_at: '2026-09-30T12:00:00+00:00',
}

/** Category scores for the four districts, as /recommend answers them. */
export const recommendFixture: Schemas['RecommendResponse'] = {
  lang: 'pl',
  weights_normalised: true,
  metrics_used: 2,
  missing_metrics: [],
  note: 'Test recommend note from the API.',
  ranking: [
    { rank: 1, code: 'delta', name: 'Delta', score: 80.5, top_drivers: [] },
    { rank: 2, code: 'gamma', name: 'Gamma', score: 60, top_drivers: [] },
    { rank: 3, code: 'beta', name: 'Beta', score: 40, top_drivers: [] },
    { rank: 4, code: 'alpha', name: 'Alpha', score: 0, top_drivers: [] },
  ],
}

export const personasFixture = {
  lang: 'pl' as const,
  personas: [
    { key: 'test_one', label: 'Test persona one', description: 'Test persona one description.', weights: { category: { cost: 5, transport: 4, safety: 0 } } },
    { key: 'test_two', label: 'Test persona two', description: 'Test persona two description.', weights: { category: { environment: 3 } } },
  ] satisfies Schemas['Persona'][],
}

/** Answers every endpoint the districts page calls, from the fixtures above. */
export function districtsApi(request: Request): Response {
  const { pathname } = new URL(request.url)
  if (pathname === '/v1/meta') {
    return jsonResponse({
      ...metaFixture,
      sources: [{ name: 'Test source A', licence: 'Test licence', attribution: 'Test credit line A', as_of: '2026-09-30', metric_keys: ['test_sale'] }],
    })
  }
  if (pathname === '/v1/districts') return jsonResponse(districtsFixture)
  if (pathname === '/v1/districts.geojson') return jsonResponse(boundariesFixture)
  if (pathname === '/v1/recommend') return jsonResponse(recommendFixture)
  if (pathname === '/v1/personas') return jsonResponse(personasFixture)
  if (pathname === '/v1/districts/beta/report') return jsonResponse(reportFixture)
  if (pathname.endsWith('/report')) return jsonResponse({ type: 'about:blank', title: 'No report', status: 404 }, 404)
  if (pathname === '/v1/districts/alpha/series/sale_price_median_m2') return jsonResponse(seriesFixture)
  if (pathname.includes('/series/')) return jsonResponse({ type: 'about:blank', title: 'No history', status: 404 }, 404)
  if (pathname === '/v1/districts/nope') return jsonResponse({ type: 'about:blank', title: 'Unknown district', status: 404 }, 404)
  if (pathname.startsWith('/v1/districts/')) return jsonResponse(detailFixture)
  if (pathname === '/v1/metrics') return jsonResponse(metricsFixture)
  if (pathname === '/v1/metrics/test_sale/values') return jsonResponse(metricValuesFixture)
  if (pathname.startsWith('/v1/metrics/')) return jsonResponse({ ...metricValuesFixture, key: 'other', values: [] })
  return jsonResponse({ type: 'about:blank', title: 'Not found', status: 404 }, 404)
}
