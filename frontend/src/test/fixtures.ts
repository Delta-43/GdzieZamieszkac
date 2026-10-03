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
  sources: [],
  score_note: 'Test score note.',
}

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': status >= 400 ? 'application/problem+json' : 'application/json' },
  })
}
