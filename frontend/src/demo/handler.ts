import type { components } from '../api/schema'
import type { components as CityComponents } from '../api/citySchema'
import { currentLanguage } from '../i18n'
import { CATEGORIES, CATEGORY_LABELS, SAFETY_KEY, SCORE_KEY, createEngine, formatNumber, type Engine, type Weights } from './engine'
import type { DemoMetric, DemoModel, Lang } from './model'
import { AI_LABEL, AI_REPORT, CHARACTER, DEMO_METHOD, FEEDBACK_NOTE, REPORT_PARTS, SAMPLE_SOURCE } from './texts'

// The data API and the city service of the live site, answered from the browser. Every route of backend/openapi.yaml and
// city-service/openapi.yaml that the app calls is here, with the same answer shapes, over the bundled sample data.
// Nothing leaves the page: there is no network call, and an address the demo does not know gets a 404.

type Schemas = components['schemas']
type CitySchemas = CityComponents['schemas']
type Answer = { status: number; body: unknown; contentType?: string }
type RankedRow = { rank: number; code: string; name: string; score: number; top_drivers: { key: string; label: string; percentile: number }[] }

const SAMPLE_DATE = '2026-10-04T10:00:00Z'
const GTFS_DAY = '2026-10-06'
const SALE_KEY = 'sale_price_median_m2'
const RENT_KEY = 'rent_price_median_m2'
const NBSP = ' '

const TEXT = {
  score_note: { en: 'Scores compare districts of this city only.', pl: 'Wyniki porównują wyłącznie dzielnice tego miasta.' },
  yield_label: { en: 'Gross rental yield', pl: 'Roczna stopa zwrotu z najmu (brutto)' },
  payback_label: { en: 'Years of rent to pay the price', pl: 'Lata najmu potrzebne do pokrycia ceny' },
  yield_method: {
    en: 'Median asking rent per m² times 12, divided by the median sale price per m².',
    pl: 'Mediana ofertowego czynszu za m² razy 12, podzielona przez medianę ceny sprzedaży za m².',
  },
  payback_method: {
    en: 'Median sale price per m² divided by the median asking rent per m² times 12.',
    pl: 'Mediana ceny sprzedaży za m² podzielona przez medianę ofertowego czynszu za m² razy 12.',
  },
  yield_caveat: {
    en: 'Asking rent over transaction price. No mortgage, tax, costs, vacancy or price change.',
    pl: 'Czynsz ofertowy w stosunku do ceny transakcyjnej. Bez kredytu, podatków, kosztów, pustostanów i zmian cen.',
  },
  similar_method: {
    en: 'Cosine similarity of the percentile ranks (centred on the city average) of the metrics used in the livability score.',
    pl: 'Podobieństwo kosinusowe rang percentylowych (względem średniej dla miasta) miar użytych we wskaźniku jakości życia.',
  },
  series_newest_caveat: {
    en: 'The newest quarter may be incomplete: the register is filled with a delay, so its median rests on fewer deeds.',
    pl: 'Najnowszy kwartał może być niepełny: rejestr jest uzupełniany z opóźnieniem, więc jego mediana opiera się na mniejszej liczbie aktów.',
  },
  series_thin_caveat: {
    en: 'Quarters marked low confidence rest on fewer than {n} deeds.',
    pl: 'Kwartały oznaczone jako mało wiarygodne opierają się na mniej niż {n} aktach.',
  },
  series_method: {
    en: 'Median price per m² of the deeds of free-market flat sales in the district, per quarter. In the demo these quarterly values are made up around the sample price.',
    pl: 'Mediana ceny za m² z aktów sprzedaży mieszkań na wolnym rynku w dzielnicy, w każdym kwartale. W wersji demonstracyjnej kwartalne wartości są wymyślone wokół przykładowej ceny.',
  },
  commute_method: {
    en: 'Simple routing over the timetable feeds, one weekday morning, between district centres, with walking to and from stops. In the demo the minutes are sample values.',
    pl: 'Proste wyznaczanie tras po rozkładach jazdy, jeden poranek dnia roboczego, między centrami dzielnic, z dojściem pieszo do przystanków i z nich. W wersji demonstracyjnej minuty są przykładowe.',
  },
  commute_caveat: {
    en: 'An estimate of typical public transport access between district centres on one weekday morning. It is not a journey plan: a real trip depends on where in the district you start and finish.',
    pl: 'Szacunek typowego dojazdu transportem publicznym między centrami dzielnic w jeden poranek dnia roboczego. To nie jest plan podróży: rzeczywisty przejazd zależy od miejsca w dzielnicy, w którym zaczynasz i kończysz podróż.',
  },
  outlook_reason: {
    en: 'No forward price scenario is published. It was tested against past data and did not do better than two simple rules: no change, and last year’s growth continuing.',
    pl: 'Nie publikujemy prognozy cen na przyszłość. Przetestowano ją na danych historycznych i nie była lepsza od dwóch prostych reguł: braku zmiany oraz kontynuacji wzrostu z ostatniego roku.',
  },
  outlook_method: {
    en: 'Momentum is the change of the median deed price per m² in the district between two quarters of the stored history. The historical range is the 10th, 50th and 90th percentile of past one-year and two-year price changes in the whole city. In the demo both are computed from sample prices.',
    pl: 'Tempo zmian to zmiana mediany ceny transakcyjnej za m² w dzielnicy między dwoma kwartałami zapisanej historii. Zakres historyczny to 10., 50. i 90. percentyl dawnych rocznych i dwuletnich zmian cen w całym mieście. W wersji demonstracyjnej oba są liczone z przykładowych cen.',
  },
  outlook_caveat: {
    en: 'This describes the past. It is not a forecast and not financial advice. Quarterly district medians are noisy, they mix new and existing flats, and the history covers one market cycle. The prices in this demo are samples.',
    pl: 'To opis przeszłości. Nie jest to prognoza ani porada finansowa. Kwartalne mediany dzielnic są niestabilne, łączą mieszkania nowe i z rynku wtórnego, a historia obejmuje jeden cykl rynkowy. Ceny w tej wersji demonstracyjnej są przykładowe.',
  },
  score_method: {
    en: 'Weighted percentile ranks of the scored measures, worked out in your browser from the sample values. Compares the districts of this city only.',
    pl: 'Ważone rangi percentylowe ocenianych miar, obliczone w Twojej przeglądarce z przykładowych wartości. Porównuje tylko dzielnice tego miasta.',
  },
  window_4: { en: 'One year', pl: 'Rok' },
  window_8: { en: 'Two years', pl: 'Dwa lata' },
  per_month: { en: 'per month', pl: 'miesięcznie' },
  years: { en: 'years', pl: 'lat' },
  and: { en: 'and', pl: 'i' },
  points: { en: 'points (0-100)', pl: 'pkt (0-100)' },
} satisfies Record<string, { en: string; pl: string }>

function problem(status: number, title: string, detail?: string): Answer {
  return { status, contentType: 'application/problem+json', body: { type: 'about:blank', title, status, ...(detail ? { detail } : {}) } }
}

let loaded: Promise<{ model: DemoModel; engine: Engine; boundaries: unknown }> | undefined
function load() {
  loaded ??= Promise.all([import('./data/model.json'), import('./data/boundaries.json')]).then(([model, boundaries]) => {
    const data = model.default as unknown as DemoModel
    return { model: data, engine: createEngine(data), boundaries: boundaries.default as unknown }
  })
  return loaded
}

const langOf = (url: URL, body?: { lang?: string }): Lang => {
  const asked = body?.lang ?? url.searchParams.get('lang')
  return asked === 'en' || asked === 'pl' ? asked : currentLanguage()
}

const percent = (fraction: number, lang: Lang, signed = false) => `${signed && fraction > 0 ? '+' : ''}${formatNumber(fraction * 100, 1, lang)}%`
const price = (value: number, lang: Lang) => `${formatNumber(Math.round(value), 0, lang)}${NBSP}PLN`

function sourceOf(model: DemoModel, metric: DemoMetric, lang: Lang): Schemas['Source'] {
  const source = model.sources[metric.source]!
  const name = lang === 'pl' ? source.pl.name : source.name
  // A value made up for the demo names the source it is modelled on, and says it is sample data.
  const sample = !metric.real && metric.source !== 'derived'
  return {
    name: sample ? `${SAMPLE_SOURCE[lang]}${name}` : name,
    ...(source.url ? { url: source.url } : {}),
    licence: lang === 'pl' ? source.pl.licence : source.licence,
    attribution: source.attribution,
  }
}

export async function demoFetch(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const route = url.pathname.replace(/^.*?\/v1/, '')
  let body: unknown
  if (request.method === 'POST') {
    try {
      body = await request.json()
    } catch {
      body = undefined
    }
  }
  const answer = await answerFor(route, request.method, url, body)
  return new Response(JSON.stringify(answer.body), {
    status: answer.status,
    headers: { 'Content-Type': answer.contentType ?? 'application/json' },
  })
}

async function answerFor(route: string, method: string, url: URL, body: unknown): Promise<Answer> {
  const { model, engine, boundaries } = await load()
  const lang = langOf(url, body as { lang?: string } | undefined)
  const byCode = new Map(model.districts.map((district) => [district.code, district]))

  // ------------------------------------------------------------------------------------------------------ helpers
  const sourcesOfMetric = (metric: DemoMetric) => sourceOf(model, metric, lang)

  function metricEntry(metric: DemoMetric, code: string): Schemas['MetricEntry'] {
    const label = metric.label[lang]
    const value = metric.available ? engine.valueOf(metric.key, code) : undefined
    if (!metric.available || !value) {
      const reason = metric.reason?.[lang] ?? (lang === 'pl' ? 'Brak wartości dla tej dzielnicy w danych źródłowych.' : 'No value for this district in the source data.')
      return { key: metric.key, available: false, label, reason }
    }
    const computed = metric.key === SCORE_KEY || metric.key === SAFETY_KEY
    const rank = engine.rankOf(metric.key, code)
    const display = computed ? `${formatNumber(value.value, 1, lang)} ${TEXT.points[lang]}` : engine.display(metric, value.value, lang)
    return {
      key: metric.key,
      available: true,
      label,
      display,
      value: value.value,
      unit: metric.unit[lang],
      data_kind: metric.data_kind,
      n_obs: value.n ?? null,
      as_of: model.sources[metric.source]!.as_of,
      source: sourcesOfMetric(metric),
      // The demo says on the value itself that it is not a measurement. The few real rows say where they come from.
      method: computed ? TEXT.score_method[lang] : metric.real ? undefined : DEMO_METHOD[lang],
      caveat: null,
      ...(rank ? { rank } : {}),
    }
  }

  const derived = (code: string, kind: 'yield_gross' | 'payback_years'): Schemas['MetricValue'] | null => {
    const sale = model.values[SALE_KEY]?.[code]
    const rent = model.values[RENT_KEY]?.[code]
    if (!sale || !rent) return null
    const yearly = (rent.value * 12) / sale.value
    const sources = [model.sources.rcn!, model.sources.rent!]
    return {
      key: kind,
      available: true,
      label: TEXT[kind === 'yield_gross' ? 'yield_label' : 'payback_label'][lang],
      display: kind === 'yield_gross' ? percent(yearly, lang) : `${formatNumber(1 / yearly, 1, lang)} ${TEXT.years[lang]}`,
      value: kind === 'yield_gross' ? yearly : 1 / yearly,
      unit: kind === 'yield_gross' ? 'fraction' : 'years',
      data_kind: 'estimated',
      n_obs: Math.min(sale.n ?? Infinity, rent.n ?? Infinity),
      as_of: '2026-09-30',
      source: {
        name: SAMPLE_SOURCE[lang] + sources.map((source) => (lang === 'pl' ? source.pl.name : source.name)).join(` ${TEXT.and[lang]} `),
        licence: sources.map((source) => (lang === 'pl' ? source.pl.licence : source.licence)).join(' / '),
        attribution: sources.map((source) => source.attribution).join('; '),
      },
      method: `${TEXT[kind === 'yield_gross' ? 'yield_method' : 'payback_method'][lang]} ${DEMO_METHOD[lang]}`,
      caveat: TEXT.yield_caveat[lang],
    }
  }

  function detail(code: string): Schemas['DistrictDetail'] {
    const district = byCode.get(code)!
    return {
      code,
      name: district.name,
      area_km2: district.area_km2,
      lang,
      livability_score: Math.round((engine.defaultScores.get(code) ?? 0) * 10) / 10,
      score_note: TEXT.score_note[lang],
      categories: CATEGORIES.map((category) => ({
        category,
        label: CATEGORY_LABELS[category]![lang],
        metrics: model.metrics.filter((metric) => metric.category === category).map((metric) => metricEntry(metric, code)),
      })),
      yield_gross: derived(code, 'yield_gross'),
      payback_years: derived(code, 'payback_years'),
    }
  }

  function ranking(weights: Weights | null) {
    const scored = engine.score(weights)
    const sorted = [...scored].sort((a, b) => b.score - a.score || a.code.localeCompare(b.code))
    return sorted.map((item, index) => ({
      rank: index + 1,
      code: item.code,
      name: byCode.get(item.code)!.name,
      score: Math.round(item.score * 10) / 10,
      top_drivers: [...item.parts]
        .sort((a, b) => b.percentile * b.share - a.percentile * a.share)
        .slice(0, 3)
        .map((part) => ({ key: part.key, label: engine.metricByKey.get(part.key)!.label[lang], percentile: Math.round(part.percentile * 10) / 10 })),
    }))
  }

  // -------------------------------------------------------------------------------------------------------- routes
  if (method === 'GET' && route === '/meta') {
    const used = new Map<string, string[]>()
    model.metrics.forEach((metric) => used.set(metric.source, [...(used.get(metric.source) ?? []), ...(metric.available ? [metric.key] : [])]))
    const sources: Schemas['Meta']['sources'] = [...Object.entries(model.sources)].map(([key, source]) => ({
      name: lang === 'pl' ? source.pl.name : source.name,
      ...(source.url ? { url: source.url } : {}),
      licence: lang === 'pl' ? source.pl.licence : source.licence,
      attribution: source.attribution,
      as_of: source.as_of,
      metric_keys: used.get(key) ?? [],
    }))
    const meta: Schemas['Meta'] = {
      city: 'krakow',
      city_name: 'Kraków',
      default_lang: 'pl',
      languages: ['pl', 'en'],
      district_count: model.districts.length,
      data_version: 'demo-sample-1',
      latest_ingestion_run: null,
      stale: { is_stale: false, reasons: [] },
      sources,
      score_note: TEXT.score_note[lang],
    }
    return { status: 200, body: meta }
  }

  if (method === 'GET' && route === '/districts') {
    const keys = [SALE_KEY, RENT_KEY]
    const list: Schemas['DistrictListItem'][] = model.districts.map((district) => ({
      code: district.code,
      name: district.name,
      area_km2: district.area_km2,
      livability_score: Math.round((engine.defaultScores.get(district.code) ?? 0) * 10) / 10,
      highlights: keys.flatMap((key) => {
        const metric = engine.metricByKey.get(key)!
        const value = engine.valueOf(key, district.code)
        return value ? [{ key, display: engine.display(metric, value.value, lang), data_kind: metric.data_kind }] : []
      }),
    }))
    return { status: 200, body: { lang, score_note: TEXT.score_note[lang], districts: list } }
  }

  if (method === 'GET' && route === '/districts.geojson') {
    const collection = boundaries as { features: { properties: Record<string, unknown> }[] }
    const slim = { ...collection, features: collection.features.map((feature) => ({ ...feature, properties: { code: feature.properties.code, name: feature.properties.name } })) }
    return { status: 200, body: slim, contentType: 'application/geo+json' }
  }

  if (method === 'GET' && route === '/metrics') {
    const metrics: Schemas['MetricDefinition'][] = model.metrics.map((metric) => ({
      key: metric.key,
      category: metric.category as Schemas['Category'],
      label: metric.label[lang],
      description: metric.description[lang],
      unit: metric.unit[lang],
      higher_is: metric.higher_is,
      refresh_cadence: metric.refresh_cadence,
      data_kind: metric.data_kind,
      available: metric.available,
      reason: metric.reason?.[lang] ?? null,
      has_series: metric.has_series,
    }))
    return { status: 200, body: { lang, metrics } }
  }

  const values = /^\/metrics\/([^/]+)\/values$/.exec(route)
  if (method === 'GET' && values) {
    const metric = engine.metricByKey.get(decodeURIComponent(values[1]!))
    if (!metric || !metric.available) return problem(404, 'Unknown metric')
    const rows = model.districts.map((district) => {
      const value = engine.valueOf(metric.key, district.code)
      return value ? { district: district.code, value: value.value, display: metric.key === SCORE_KEY ? `${formatNumber(value.value, 1, lang)} ${TEXT.points[lang]}` : engine.display(metric, value.value, lang), data_kind: metric.data_kind, n_obs: value.n ?? null, rank: engine.rankOf(metric.key, district.code) } : undefined
    })
    const present = rows.filter((row) => row !== undefined)
    // Best first for a measure with a direction, else the largest first.
    present.sort((a, b) => (metric.higher_is === 'worse' ? a.value - b.value : b.value - a.value))
    const clean = present.map((row) => (row.rank ? row : { ...row, rank: undefined }))
    return { status: 200, body: { key: metric.key, label: metric.label[lang], lang, higher_is: metric.higher_is, values: clean } }
  }

  if (method === 'GET' && route === '/personas') {
    const personas: Schemas['Persona'][] = model.personas.map((persona) => ({
      key: persona.key,
      label: persona.label[lang],
      description: persona.description[lang],
      weights: persona.weights as Schemas['Weights'],
    }))
    return { status: 200, body: { lang, personas } }
  }

  if (method === 'POST' && route === '/recommend') {
    const request = (body ?? {}) as { weights?: Weights }
    const weights = request.weights ?? null
    const errors = validateWeights(weights, engine)
    if (errors) return problem(422, 'Invalid weights', errors)
    const missing = model.metrics.filter((metric) => !metric.available && metric.higher_is !== 'neutral').map((metric) => metric.key)
    const answer: Schemas['RecommendResponse'] = {
      lang,
      weights_normalised: weights !== null,
      metrics_used: engine.score(weights)[0]?.usedCount ?? 0,
      missing_metrics: missing,
      note: TEXT.score_note[lang],
      ranking: ranking(weights),
    }
    return { status: 200, body: answer }
  }

  if (method === 'GET' && route === '/compare') {
    const codes = (url.searchParams.get('codes') ?? '').split(',').map((code) => code.trim()).filter(Boolean)
    if (codes.length < 2 || codes.length > 4) return problem(422, 'Choose two to four districts')
    const unknown = codes.find((code) => !byCode.has(code))
    if (unknown) return problem(404, 'Unknown district', unknown)
    return { status: 200, body: { lang, districts: codes.map(detail) } }
  }

  if (method === 'GET' && route === '/commute') {
    const from = url.searchParams.get('from') ?? ''
    if (!byCode.has(from)) return problem(404, 'Unknown district', from)
    const answer: Schemas['Commute'] = {
      from,
      lang,
      data_kind: 'estimated',
      method: TEXT.commute_method[lang],
      as_of: GTFS_DAY,
      caveat: TEXT.commute_caveat[lang],
      destinations: model.districts.map((district) => ({ code: district.code, minutes: model.commute[from]?.[district.code] ?? null })),
    }
    return { status: 200, body: answer }
  }

  // ------------------------------------------------------------------------------------------ one district's routes
  const one = /^\/districts\/([^/]+)(?:\/(report|similar|outlook|rent-vs-buy|series)(?:\/([^/]+))?)?$/.exec(route)
  if (method === 'GET' && one) {
    const code = decodeURIComponent(one[1]!)
    const part = one[2]
    if (!byCode.has(code)) return problem(404, 'Unknown district', code)
    const district = byCode.get(code)!

    if (!part) return { status: 200, body: detail(code) }

    if (part === 'report') {
      const score = Math.round((engine.defaultScores.get(code) ?? 0) * 10) / 10
      const rank = engine.rankOf(SCORE_KEY, code)
      const item = engine.score().find((entry) => entry.code === code)!
      const ordered = [...item.parts].sort((a, b) => b.percentile - a.percentile)
      const labelOf = (key: string) => `${lang === 'pl' ? '„' : '“'}${engine.metricByKey.get(key)!.label[lang].replace(/\s*\(.*\)\s*$/, '')}”`
      const best = ordered.slice(0, 2).map((part) => labelOf(part.key)).join(', ')
      const worst = ordered.slice(-2).reverse().map((part) => labelOf(part.key)).join(', ')
      const salePrice = engine.valueOf(SALE_KEY, code)
      const fill = (text: string) =>
        text
          .replace('{name}', district.name)
          .replace('{score}', formatNumber(score, 1, lang))
          .replace('{rank}', String(rank?.position ?? ''))
          .replace('{of}', String(rank?.of ?? ''))
          .replace('{price}', `${formatNumber(salePrice?.value ?? 0, 0, lang)} ${lang === 'pl' ? 'zł za m²' : 'PLN per m²'}`)
          .replace('{best}', best)
          .replace('{worst}', worst)
      const text = [CHARACTER[code]![lang], fill(REPORT_PARTS.figures[lang]), REPORT_PARTS.disclaimer[lang]].join('\n\n')
      const report: Schemas['Report'] = {
        district: code,
        lang,
        lang_fallback: false,
        livability_score: score,
        body: text,
        model: 'sample text, written in advance',
        generated_at: SAMPLE_DATE,
        estimated_or_proxy_values_flagged: true,
      }
      return { status: 200, body: report }
    }

    if (part === 'similar') {
      const limit = Math.min(10, Math.max(1, Number(url.searchParams.get('limit')) || 3))
      return {
        status: 200,
        body: {
          district: code,
          lang,
          method: TEXT.similar_method[lang],
          similar: engine.similar(code, limit).map((item) => ({ ...item, name: byCode.get(item.code)!.name })),
        },
      }
    }

    if (part === 'series') {
      const key = decodeURIComponent(one[3] ?? '')
      if (key !== SALE_KEY) return problem(404, 'No history for this measure')
      const metric = engine.metricByKey.get(key)!
      const points = seriesPoints(model, code, metric, lang, engine)
      const series: Schemas['Series'] = {
        district: code,
        key,
        label: metric.label[lang],
        lang,
        unit: metric.unit[lang],
        data_kind: metric.data_kind,
        min_obs: 30,
        source: sourcesOfMetric(metric),
        method: `${TEXT.series_method[lang]}`,
        caveat: `${TEXT.series_newest_caveat[lang]} ${TEXT.series_thin_caveat[lang].replace('{n}', '30')}`,
        points,
      }
      return { status: 200, body: series }
    }

    if (part === 'outlook') return { status: 200, body: outlook(model, engine, code, lang) }

    if (part === 'rent-vs-buy') {
      const area = Number(url.searchParams.get('area_m2'))
      if (!Number.isFinite(area) || area < 15 || area > 250) return problem(422, 'The size must be between 15 and 250 m²')
      const sale = engine.valueOf(SALE_KEY, code)!
      const rent = engine.valueOf(RENT_KEY, code)!
      const yearly = (rent.value * 12) / sale.value
      const totalPrice = Math.round(sale.value * area)
      const totalRent = Math.round(rent.value * area)
      const answer: Schemas['RentVsBuy'] = {
        district: code,
        lang,
        area_m2: area,
        price: { value: totalPrice, currency: 'PLN', display: price(totalPrice, lang) },
        monthly_rent: { value: totalRent, currency: 'PLN', display: `${price(totalRent, lang)} ${TEXT.per_month[lang]}` },
        yield_gross: yearly,
        yield_display: percent(yearly, lang),
        payback_years: 1 / yearly,
        payback_display: `${formatNumber(1 / yearly, 1, lang)} ${TEXT.years[lang]}`,
        data_kind: 'estimated',
        based_on: [SALE_KEY, RENT_KEY].map((key) => ({ key, display: engine.display(engine.metricByKey.get(key)!, engine.valueOf(key, code)!.value, lang), data_kind: 'observed' as const })),
        caveat: `${TEXT.yield_caveat[lang]} ${DEMO_METHOD[lang]}`,
      }
      return { status: 200, body: answer }
    }
  }

  // ------------------------------------------------------------------------------------------------- city service
  if (method === 'GET' && route === '/feedback/status') {
    const status: CitySchemas['FeedbackStatus'] = {
      accepting: false,
      identity_check: 'not_yet',
      stored_as: 'unverified',
      published: false,
      affects_scores: false,
      note: FEEDBACK_NOTE,
    }
    return { status: 200, body: status }
  }

  if (method === 'POST' && route === '/feedback') {
    // The forms are switched off in the demo, so this is not reached from the page.
    return problem(503, 'Feedback is switched off in the demo', 'Nothing is sent or stored.')
  }

  if (method === 'POST' && route === '/ai-report') {
    const request = (body ?? {}) as { requirements?: string; weights?: Weights; persona?: string }
    if (typeof request.requirements !== 'string' || request.requirements.trim().length < 3) return problem(422, 'The text is too short')
    const errors = validateWeights(request.weights ?? null, engine)
    if (errors) return problem(422, 'Invalid weights', errors)
    // A short wait, so the page shows the same "writing" state as the live service.
    await new Promise((resolve) => setTimeout(resolve, 700))
    return { status: 200, body: aiReport(model, ranking(request.weights ?? null), request.weights ?? null, lang) }
  }

  return problem(404, 'Not found', 'This address is not part of the demo.')
}

function validateWeights(weights: Weights | null, engine: Engine): string | null {
  if (!weights) return null
  const categories = Object.entries(weights.category ?? {})
  for (const [name, value] of categories) {
    if (!(CATEGORIES as readonly string[]).includes(name)) return `Unknown category: ${name}`
    if (typeof value !== 'number' || value < 0 || value > 5) return `Weight of ${name} must be between 0 and 5`
  }
  for (const [key, value] of Object.entries(weights.metric ?? {})) {
    if (!engine.metricByKey.has(key)) return `Unknown metric: ${key}`
    if (typeof value !== 'number' || value < 0 || value > 5) return `Weight of ${key} must be between 0 and 5`
  }
  if (engine.score(weights)[0]?.usedCount === 0) return 'At least one weight must be above zero'
  return null
}

function quarterStart(year: number, quarter: number) {
  return `${year}-${String(quarter * 3 + 1).padStart(2, '0')}-01`
}
function quarterEnd(year: number, quarter: number) {
  return `${year}-${['03-31', '06-30', '09-30', '12-31'][quarter]}`
}

function seriesPoints(model: DemoModel, code: string, metric: DemoMetric, lang: Lang, engine: Engine): Schemas['Series']['points'] {
  return (model.series[code] ?? []).map((point) => ({
    period_start: quarterStart(point.year, point.quarter),
    period_end: quarterEnd(point.year, point.quarter),
    value: point.value,
    display: engine.display(metric, point.value, lang),
    n_obs: point.n,
    low_confidence: point.n < 30,
  }))
}

function percentile(sorted: number[], p: number) {
  const index = (sorted.length - 1) * p
  const low = Math.floor(index)
  const high = Math.ceil(index)
  return sorted[low]! + (sorted[high]! - sorted[low]!) * (index - low)
}

function outlook(model: DemoModel, engine: Engine, code: string, lang: Lang): Schemas['Outlook'] {
  const metric = engine.metricByKey.get(SALE_KEY)!
  const points = model.series[code] ?? []
  const label = (point: { year: number; quarter: number }) => quarterStart(point.year, point.quarter)
  const growth = (from: (typeof points)[number] | undefined, to: (typeof points)[number] | undefined, annualise: boolean): Schemas['Growth'] | null => {
    if (!from || !to) return null
    const change = to.value / from.value - 1
    const years = (points.indexOf(to) - points.indexOf(from)) / 4
    const annual = annualise && years > 0 ? (1 + change) ** (1 / years) - 1 : null
    return {
      value: change,
      display: percent(change, lang, true),
      annualised: annual,
      annualised_display: annual === null ? null : percent(annual, lang, true),
      from: label(from),
      to: label(to),
      from_display: engine.display(metric, from.value, lang),
      to_display: engine.display(metric, to.value, lang),
      n_obs_from: from.n,
      n_obs_to: to.n,
      low_confidence: from.n < 30 || to.n < 30,
    }
  }
  const last = points[points.length - 1]
  // The newest quarter rests on few deeds (the register fills with a delay), so the last year ends one quarter before it.
  const end = points[points.length - 2]
  const windows: NonNullable<Schemas['Outlook']['city_history']['windows']> = [4, 8].map((quarters) => {
    // The city index: the mean of every district's price relative to its first quarter.
    const city = (points.map((_, i) => model.districts.reduce((sum, district) => sum + (model.series[district.code]![i]!.value / model.series[district.code]![0]!.value), 0) / model.districts.length))
    const changes = city.slice(quarters).map((value, i) => value / city[i]! - 1).sort((a, b) => a - b)
    const low = percentile(changes, 0.1)
    const median = percentile(changes, 0.5)
    const high = percentile(changes, 0.9)
    return {
      quarters,
      label: TEXT[quarters === 4 ? 'window_4' : 'window_8'][lang],
      low,
      median,
      high,
      low_display: percent(low, lang, true),
      median_display: percent(median, lang, true),
      high_display: percent(high, lang, true),
      n_windows: changes.length,
    }
  })
  const results = (['4', '8'] as const).flatMap((horizon) =>
    (['history_range', 'damped_momentum'] as const).map((method) => {
      const entry = model.backtest.horizons[horizon]![method]!
      return {
        quarters: Number(horizon),
        method,
        origins: entry.origins,
        mae_method: entry.mae_method,
        mae_no_change: entry.mae_no_change,
        mae_last_year_continues: entry.mae_last_year_continues,
        coverage_80: entry.coverage_80,
        passes: entry.passes,
      }
    }),
  )
  const nbp = model.sources.nbp!
  return {
    district: code,
    lang,
    data_kind: 'observed',
    momentum: {
      growth_12m: growth(points[points.length - 6], end, false),
      growth_since_start: growth(points[0], last ? end : undefined, true),
    },
    city_history: {
      available: true,
      period_start: '2021-01-01',
      period_end: '2026-06-30',
      windows,
      source: { name: lang === 'pl' ? nbp.pl.name : nbp.name, ...(nbp.url ? { url: nbp.url } : {}), licence: lang === 'pl' ? nbp.pl.licence : nbp.licence, attribution: nbp.attribution },
      method: TEXT.outlook_method[lang],
    },
    scenario: {
      published: false,
      reason: TEXT.outlook_reason[lang],
      ranges: [],
      backtest: { period_start: model.backtest.period[0], period_end: model.backtest.period[1], cities: model.backtest.cities, results },
    },
    method: TEXT.outlook_method[lang],
    caveat: TEXT.outlook_caveat[lang],
  }
}

function aiReport(model: DemoModel, ranked: RankedRow[], weights: Weights | null, lang: Lang): CitySchemas['AiReport'] {
  const top = ranked.slice(0, 3)
  // A profile of the page is recognised by its weights; a category a profile does not mention counts as 1.
  const persona = weights?.category
    ? model.personas.find((candidate) => CATEGORIES.filter((c) => c !== 'demographics').every((c) => (weights.category?.[c] ?? 1) === (candidate.weights.category[c] ?? 1)))
    : undefined
  const score = (value: number) => `${formatNumber(value, 1, lang)}`
  const fill = (text: string, extra: Record<string, string> = {}) => {
    const values: Record<string, string> = { n1: top[0]?.name ?? '', n2: top[1]?.name ?? '', n3: top[2]?.name ?? '', s1: score(top[0]?.score ?? 0), s2: score(top[1]?.score ?? 0), s3: score(top[2]?.score ?? 0), ...extra }
    return text.replace(/\{(\w+)\}/g, (_, key: string) => values[key] ?? '')
  }
  const quote = (text: string) => `${lang === 'pl' ? '„' : '“'}${text}”`
  const drivers = (top[0]?.top_drivers ?? []).map((driver) => quote(driver.label.replace(/\s*\(.*\)\s*$/, ''))).join(', ')
  const first = persona
    ? fill(AI_REPORT.profile[lang], { label: persona.label[lang], description: persona.description[lang].replace(/\.$/, '').toLowerCase() })
    : fill(AI_REPORT.custom[lang])
  const reportText = [first, fill(AI_REPORT.drivers[lang], { d1: drivers }), AI_REPORT.note[lang]].join('\n\n')
  const others = ranked.length - 1
  const facts = top.flatMap((item) => [
    lang === 'pl' ? `${item.name}: miejsce ${item.rank}, ${score(item.score)} pkt (0-100).` : `${item.name}: place ${item.rank}, ${score(item.score)} points (0-100).`,
    ...item.top_drivers.map((driver) => {
      const better = Math.round((driver.percentile / 100) * others)
      return lang === 'pl'
        ? `${item.name}, ${driver.label}: lepszy niż w ${better} z ${others} pozostałych dzielnic.`
        : `${item.name}, ${driver.label}: better than ${better} of ${others} other districts.`
    }),
  ])
  return {
    lang,
    ai_generated: true,
    label: AI_LABEL[lang],
    model: lang === 'pl' ? 'przykładowy tekst, napisany z wyprzedzeniem' : 'sample text, written in advance',
    generated_at: SAMPLE_DATE,
    report: reportText,
    basis: { persona: persona?.key ?? null, weights: weights ? (weights as CitySchemas['Weights']) : null, note: TEXT.score_note[lang] },
    districts: top.map((item) => ({
      rank: item.rank,
      code: item.code,
      name: item.name,
      score: item.score,
      score_display: lang === 'pl' ? `${score(item.score)} pkt (0-100)` : `${score(item.score)} points (0-100)`,
    })),
    facts,
  }
}
