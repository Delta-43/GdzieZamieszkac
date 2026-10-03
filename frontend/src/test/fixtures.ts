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
