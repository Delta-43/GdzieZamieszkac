import type { components as cityComponents } from '../api/citySchema'
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

/** Rent versus buy, as the API estimates it. The price follows the size that was asked for. */
export const rentVsBuyFixture: Schemas['RentVsBuy'] = {
  district: 'alpha',
  lang: 'pl',
  area_m2: 50,
  price: { value: 5000, currency: 'TST', display: '5000 test price' },
  monthly_rent: { value: 30, currency: 'TST', display: '30 test rent a month' },
  yield_gross: 0.05,
  yield_display: '5 test%',
  payback_years: 17.8,
  payback_display: '17,8 test years',
  data_kind: 'estimated',
  based_on: [
    { key: 'test_sale', display: '100 test', data_kind: 'observed' },
    { key: 'test_rent', display: '10 test', data_kind: 'estimated' },
  ],
  caveat: 'Test rent versus buy caveat.',
}

/** The districts most like Alpha. The contract has no named schema for this answer. */
export const similarFixture = {
  district: 'alpha',
  lang: 'pl',
  method: 'Test similar method.',
  similar: [
    { code: 'beta', name: 'Beta', similarity: 0.769, closest_on: ['test_sale', 'test_rent'] },
    { code: 'gamma', name: 'Gamma', similarity: 0.5, closest_on: [] },
  ],
}

/** The outlook of Alpha: one change with data, one without, the city's past, and no published forecast. */
export const outlookFixture: Schemas['Outlook'] = {
  district: 'alpha',
  lang: 'pl',
  data_kind: 'observed',
  momentum: {
    growth_12m: {
      value: 0.1,
      display: '+10 test%',
      annualised: null,
      annualised_display: null,
      from: '2025-04-01',
      to: '2026-04-01',
      from_display: '100 test',
      to_display: '110 test',
      n_obs_from: 78,
      n_obs_to: 12,
      low_confidence: true,
    },
    growth_since_start: null,
  },
  city_history: {
    available: true,
    period_start: '2006-06-01',
    period_end: '2026-05-31',
    windows: [{ quarters: 4, label: 'Test year', low: -0.05, median: 0.03, high: 0.15, low_display: '-5 test%', median_display: '+3 test%', high_display: '+15 test%', n_windows: 76 }],
    source: { name: 'Test city source', licence: 'Test city licence', attribution: 'Test city credit' },
    method: 'Test city method.',
  },
  scenario: {
    published: false,
    reason: 'Test reason for no forecast.',
    ranges: [],
    backtest: {
      period_start: '2006-08-31',
      period_end: '2026-05-31',
      cities: 17,
      results: [{ quarters: 4, method: 'Test method name', origins: 816, mae_method: 0.0619, mae_no_change: 0.0712, mae_last_year_continues: 0.0415, coverage_80: 0.686, passes: false }],
    },
  },
  method: 'Test outlook method.',
  caveat: 'Test outlook caveat: a record of the past, not a forecast.',
}

/** Travel times from Alpha, as /commute answers them: out of order, with Alpha itself, and one district without a connection. */
export const commuteFixture: Schemas['Commute'] = {
  from: 'alpha',
  lang: 'pl',
  data_kind: 'estimated',
  method: 'Test commute method.',
  as_of: '2026-10-07',
  caveat: 'Test commute caveat from the API.',
  destinations: [
    { code: 'alpha', minutes: 0 },
    { code: 'beta', minutes: 41.5 },
    { code: 'gamma', minutes: null },
    { code: 'delta', minutes: 12 },
  ],
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
      sources: [
        { name: 'Test source A', licence: 'Test licence', attribution: 'Test credit line A', as_of: '2026-09-30', metric_keys: ['test_sale'], url: 'https://example.org/source-a ; https://example.org/source-a2' },
        { name: 'Test source B', licence: 'Test licence', attribution: 'Test credit line B' },
        { name: 'Test listings', licence: 'Test licence', attribution: 'Test listings credit', url: 'https://www.otodom.pl' },
      ],
    })
  }
  if (pathname === '/v1/districts') return jsonResponse(districtsFixture)
  if (pathname === '/v1/districts.geojson') return jsonResponse(boundariesFixture)
  if (pathname === '/v1/recommend') return jsonResponse(recommendFixture)
  if (pathname === '/v1/personas') return jsonResponse(personasFixture)
  if (pathname === '/v1/compare') {
    const codes = (new URL(request.url).searchParams.get('codes') ?? '').split(',')
    if (codes.includes('nope')) return jsonResponse({ type: 'about:blank', title: 'Unknown district', status: 404 }, 404)
    // Every district answers with the detail fixture under its own code. Beta has no rental values and no sale price.
    return jsonResponse({
      lang: 'pl',
      districts: codes.map((code) => ({
        ...detailFixture,
        code,
        name: code.charAt(0).toUpperCase() + code.slice(1),
        ...(code === 'beta'
          ? { yield_gross: null, categories: detailFixture.categories.map((category) => ({ ...category, metrics: category.metrics.filter((metric) => metric.key !== 'test_sale') })) }
          : {}),
      })),
    })
  }
  if (pathname.endsWith('/rent-vs-buy')) {
    const size = Number(new URL(request.url).searchParams.get('area_m2'))
    return jsonResponse({ ...rentVsBuyFixture, area_m2: size, price: { value: size * 100, currency: 'TST', display: `${size * 100} test price` } })
  }
  if (pathname.endsWith('/similar')) return jsonResponse(similarFixture)
  if (pathname === '/v1/districts/alpha/outlook') return jsonResponse(outlookFixture)
  // The other districts answer as an API with the feature switched off: the section must hide.
  if (pathname.endsWith('/outlook')) return jsonResponse({ type: 'about:blank', title: 'Not implemented', status: 501 }, 501)
  if (pathname === '/v1/districts/beta/report') return jsonResponse(reportFixture)
  if (pathname.endsWith('/report')) return jsonResponse({ type: 'about:blank', title: 'No report', status: 404 }, 404)
  if (pathname === '/v1/districts/alpha/series/sale_price_median_m2') return jsonResponse(seriesFixture)
  if (pathname.includes('/series/')) return jsonResponse({ type: 'about:blank', title: 'No history', status: 404 }, 404)
  if (pathname === '/v1/districts/nope') return jsonResponse({ type: 'about:blank', title: 'Unknown district', status: 404 }, 404)
  if (pathname.startsWith('/v1/districts/')) return jsonResponse(detailFixture)
  if (pathname === '/v1/commute') return jsonResponse(commuteFixture)
  if (pathname === '/v1/metrics') return jsonResponse(metricsFixture)
  if (pathname === '/v1/metrics/test_sale/values') return jsonResponse(metricValuesFixture)
  if (pathname.startsWith('/v1/metrics/')) return jsonResponse({ ...metricValuesFixture, key: 'other', values: [] })
  return jsonResponse({ type: 'about:blank', title: 'Not found', status: 404 }, 404)
}

/** The AI report of the city service, as POST /v1/ai-report answers it. */
export const aiReportFixture: cityComponents['schemas']['AiReport'] = {
  lang: 'pl',
  ai_generated: true,
  label: 'Test AI label from the API.',
  model: 'test-model',
  generated_at: '2026-10-01T12:00:00+00:00',
  report: 'Test AI report first paragraph.\n\nTest AI report <b>second</b> paragraph.',
  basis: { persona: null, weights: null, note: 'Test AI report note from the API.' },
  districts: [
    { rank: 1, code: 'delta', name: 'Delta', score: 80.5, score_display: '80,5 test pts' },
    { rank: 2, code: 'gamma', name: 'Gamma', score: 60, score_display: '60 test pts' },
    { rank: 3, code: 'beta', name: 'Beta', score: 40, score_display: '40 test pts' },
  ],
  facts: ['Test fact one.', 'Test fact two.'],
}

/** What the city service says about a report, as GET /v1/feedback/status answers it. */
export const feedbackStatusFixture: cityComponents['schemas']['FeedbackStatus'] = {
  accepting: true,
  identity_check: 'not_yet',
  stored_as: 'unverified',
  published: false,
  affects_scores: false,
  note: { pl: 'Test notatka o zgłoszeniach.', en: 'Test note about reports.' },
}

/** The receipt of POST /v1/feedback. */
export const feedbackReceiptFixture: cityComponents['schemas']['FeedbackReceipt'] = {
  id: 'test-id',
  status: 'unverified',
  published: false,
  note: { pl: 'Test notatka po wysłaniu.', en: 'Test note after sending.' },
}
