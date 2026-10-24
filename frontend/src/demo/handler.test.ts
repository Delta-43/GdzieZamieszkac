import { expect, test, vi } from 'vitest'
import { demoFetch } from './handler'

// The demo answers every call of the app from the sample data bundled with it. These tests call it as the app does, with a Request,
// and check that nothing goes to the network.

type Json = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any -- the shapes are the contracts, checked by the type check of the handler

async function call(path: string, init?: { method?: string; body?: unknown }): Promise<{ status: number; body: Json }> {
  const spy = vi.spyOn(globalThis, 'fetch')
  const response = await demoFetch(
    new Request(`https://demo.invalid/v1${path}`, {
      method: init?.method ?? 'GET',
      ...(init?.body === undefined ? {} : { body: JSON.stringify(init.body), headers: { 'Content-Type': 'application/json' } }),
    }),
  )
  expect(spy).not.toHaveBeenCalled()
  return { status: response.status, body: (await response.json()) as Json }
}

const FAMILY = { safety: 5, environment: 4, amenities: 4, livability: 3, transport: 3, cost: 3 }

test('meta lists 18 districts of Kraków and the credit line of every source', async () => {
  const { body } = await call('/meta?lang=en')
  expect(body.city_name).toBe('Kraków')
  expect(body.district_count).toBe(18)
  expect(body.stale.is_stale).toBe(false)
  expect(body.sources.length).toBeGreaterThan(10)
  expect(body.sources.every((source: Json) => source.attribution && source.licence)).toBe(true)
})

test('the catalogue has 51 measures, 47 with data and a reason for each of the four gaps, in both languages', async () => {
  for (const lang of ['pl', 'en']) {
    const { body } = await call(`/metrics?lang=${lang}`)
    expect(body.metrics).toHaveLength(51)
    const gaps = body.metrics.filter((metric: Json) => !metric.available)
    expect(gaps).toHaveLength(4)
    expect(gaps.every((metric: Json) => metric.reason)).toBe(true)
  }
})

test('the default ranking equals the score of the district list, and the profile Family changes it', async () => {
  const list = await call('/districts?lang=pl')
  expect(list.body.districts).toHaveLength(18)
  const byScore = new Map<string, number>(list.body.districts.map((district: Json) => [district.code, district.livability_score]))
  const plain = await call('/recommend', { method: 'POST', body: {} })
  expect(plain.body.ranking).toHaveLength(18)
  for (const item of plain.body.ranking) expect(item.score).toBe(byScore.get(item.code))
  const family = await call('/recommend', { method: 'POST', body: { weights: { category: FAMILY } } })
  const scores: number[] = family.body.ranking.map((item: Json) => item.score)
  expect(scores).toEqual([...scores].sort((a, b) => b - a))
  expect(family.body.ranking.map((item: Json) => item.rank)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1))
  expect(family.body.ranking.map((item: Json) => item.code)).not.toEqual(plain.body.ranking.map((item: Json) => item.code))
  expect(family.body.ranking[0].top_drivers).toHaveLength(3)
  expect(family.body.missing_metrics).toContain('crimes_per_10k')
})

test('weights that are all zero, or out of range, are refused with a 422 like the API does', async () => {
  const zero = await call('/recommend', { method: 'POST', body: { weights: { category: { transport: 0, livability: 0, amenities: 0, environment: 0, cost: 0, safety: 0, demographics: 0 } } } })
  expect(zero.status).toBe(422)
  const high = await call('/recommend', { method: 'POST', body: { weights: { category: { cost: 9 } } } })
  expect(high.status).toBe(422)
})

test('the district Łagiewniki-Borek Fałęcki has a score, a rank, a source for a value and a labelled gap', async () => {
  const { status, body } = await call('/districts/lagiewniki-borek-falecki?lang=en')
  expect(status).toBe(200)
  expect(body.name).toBe('Łagiewniki-Borek Fałęcki')
  expect(body.categories).toHaveLength(7)
  const metrics: Json[] = body.categories.flatMap((category: Json) => category.metrics)
  const sale = metrics.find((metric) => metric.key === 'sale_price_median_m2')!
  expect(sale.display).toMatch(/PLN per m²/)
  expect(sale.rank.of).toBe(18)
  expect(sale.source.attribution).toMatch(/RCN|Rejestr Cen Nieruchomości/)
  expect(sale.method).toMatch(/demo|made up/i)
  // A value that is made up never reads as a real source: the name says it is sample data. The real rows keep the name of the source.
  expect(sale.source.name).toMatch(/^Sample data, modelled on: /)
  expect(metrics.find((metric) => metric.key === 'amenity_aed_public')!.source.name).not.toMatch(/^Sample data/)
  expect(metrics.find((metric) => metric.key === 'crimes_per_10k')).toMatchObject({ available: false })
  expect(body.yield_gross.display).toMatch(/%$/)
})

test('the stored report is labelled as a sample and says it was not generated live', async () => {
  const { body } = await call('/districts/lagiewniki-borek-falecki/report?lang=en')
  expect(body.lang_fallback).toBe(false)
  expect(body.body).toMatch(/sample/i)
  expect(body.body).toMatch(/not generated live/)
  expect(body.model).toMatch(/sample/)
  const pl = await call('/districts/lagiewniki-borek-falecki/report?lang=pl')
  expect(pl.body.body).toMatch(/przykładowy/)
})

test('deed prices come as 22 quarters with low-confidence marks, and the outlook is history with no forecast', async () => {
  const series = await call('/districts/lagiewniki-borek-falecki/series/sale_price_median_m2?lang=en')
  expect(series.body.points).toHaveLength(22)
  expect(series.body.points[0].period_start).toBe('2021-01-01')
  expect(series.body.points.at(-1).period_end).toBe('2026-06-30')
  expect(series.body.min_obs).toBe(30)
  const none = await call('/districts/lagiewniki-borek-falecki/series/age_mean')
  expect(none.status).toBe(404)
  const outlook = await call('/districts/lagiewniki-borek-falecki/outlook?lang=en')
  expect(outlook.body.scenario.published).toBe(false)
  expect(outlook.body.momentum.growth_12m.display).toMatch(/^\+|^-/)
  expect(outlook.body.city_history.windows).toHaveLength(2)
})

test('commute lists every district, 0 minutes to itself', async () => {
  const { body } = await call('/commute?from=lagiewniki-borek-falecki&lang=pl')
  expect(body.destinations).toHaveLength(18)
  expect(body.destinations.find((row: Json) => row.code === 'lagiewniki-borek-falecki').minutes).toBe(0)
  expect((await call('/commute?from=nowhere')).status).toBe(404)
})

test('compare answers for two to four districts in the order asked and refuses other counts', async () => {
  const { body } = await call('/compare?codes=lagiewniki-borek-falecki,stare-miasto&lang=en')
  expect(body.districts.map((district: Json) => district.code)).toEqual(['lagiewniki-borek-falecki', 'stare-miasto'])
  expect((await call('/compare?codes=stare-miasto')).status).toBe(422)
  expect((await call('/compare?codes=stare-miasto,nowhere')).status).toBe(404)
})

test('rent against purchase, similar districts and the personas answer', async () => {
  const rent = await call('/districts/stare-miasto/rent-vs-buy?area_m2=50&lang=en')
  expect(rent.body.price.value).toBeGreaterThan(rent.body.monthly_rent.value * 100)
  expect((await call('/districts/stare-miasto/rent-vs-buy?area_m2=5')).status).toBe(422)
  const similar = await call('/districts/stare-miasto/similar?lang=en')
  expect(similar.body.similar).toHaveLength(3)
  const personas = await call('/personas?lang=pl')
  expect(personas.body.personas.map((persona: Json) => persona.key)).toContain('family')
})

test('the map shapes hold the 18 districts', async () => {
  const { body } = await call('/districts.geojson')
  expect(body.features).toHaveLength(18)
  expect(body.features[0].properties).toEqual({ code: expect.any(String), name: expect.any(String) })
})

test('the AI summary is a labelled sample, follows the ranking and knows the profile Family by its weights', async () => {
  const { status, body } = await call('/ai-report', { method: 'POST', body: { requirements: 'Quiet, near a school', lang: 'en', weights: { category: FAMILY } } })
  expect(status).toBe(200)
  expect(body.ai_generated).toBe(true)
  expect(body.label).toMatch(/Sample text/)
  expect(body.basis.persona).toBe('family')
  expect(body.districts).toHaveLength(3)
  const ranking = await call('/recommend', { method: 'POST', body: { weights: { category: FAMILY } } })
  expect(body.districts.map((district: Json) => district.code)).toEqual(ranking.body.ranking.slice(0, 3).map((item: Json) => item.code))
  expect(body.report).toContain(body.districts[0].name)
  const custom = await call('/ai-report', { method: 'POST', body: { requirements: 'abc', lang: 'pl', weights: { category: { cost: 5, transport: 1, safety: 0 } } } })
  expect(custom.body.basis.persona).toBeNull()
  const short = await call('/ai-report', { method: 'POST', body: { requirements: 'a' } })
  expect(short.status).toBe(422)
})

test('feedback is switched off: the status says it does not accept reports and a send is refused', async () => {
  const status = await call('/feedback/status')
  expect(status.body.accepting).toBe(false)
  expect(status.body.note.en).toMatch(/demo/i)
  expect(status.body.note.pl).toMatch(/demonstracyjna/)
  const sent = await call('/feedback', { method: 'POST', body: { type: 'rent_paid' } })
  expect(sent.status).toBe(503)
})

test('an address the demo does not know is a 404, never a request to a server', async () => {
  const { status } = await call('/nothing/here')
  expect(status).toBe(404)
})
