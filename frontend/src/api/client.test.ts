import { expect, test, vi } from 'vitest'
import { jsonResponse, metaFixture } from '../test/fixtures'
import { api } from './client'

test('calls the API under /v1 and sends the language', async () => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse(metaFixture))

  const { data } = await api.GET('/meta', { params: { query: { lang: 'pl' } } })

  const request = fetchMock.mock.calls[0]?.[0] as Request
  expect(request.url).toBe('http://api.test/v1/meta?lang=pl')
  expect(data?.district_count).toBe(4)
})

test('returns a problem+json error as the error value', async () => {
  vi.spyOn(globalThis, 'fetch').mockResolvedValue(
    jsonResponse({ type: 'about:blank', title: 'Data unavailable', status: 503 }, 503),
  )

  const { data, error } = await api.GET('/meta', { params: { query: { lang: 'pl' } } })

  expect(data).toBeUndefined()
  expect(error?.status).toBe(503)
})
